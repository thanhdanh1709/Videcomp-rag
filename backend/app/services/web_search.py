"""Dịch vụ tìm kiếm Web thời gian thực (Web Search) cho Videcomp-rag.

Hỗ trợ lấy thông tin, văn bản, tin tức mới nhất từ Internet để bổ sung bằng chứng
cho pipeline RAG khi người dùng kích hoạt nút Tìm kiếm Web.
"""
from __future__ import annotations

import hashlib
import logging
import re
from typing import Any

import httpx
from bs4 import BeautifulSoup

from ..schemas.evidence import EvidenceCandidate

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"


def search_web(query: str, max_results: int = 4) -> list[dict[str, str]]:
    """Tìm kiếm web thời gian thực qua DuckDuckGo Lite / HTML.
    Trả về danh sách [{'title': ..., 'snippet': ..., 'url': ...}].
    """
    clean_query = query.strip()
    if not clean_query:
        return []

    results: list[dict[str, str]] = []
    try:
        url = "https://lite.duckduckgo.com/lite/"
        headers = {"User-Agent": USER_AGENT}
        data = {"q": clean_query}

        with httpx.Client(timeout=8.0, follow_redirects=True) as client:
            resp = client.post(url, data=data, headers=headers)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                rows = soup.select("table tr")
                curr_title = ""
                curr_url = ""
                for tr in rows:
                    link = tr.select_one("a.result-link")
                    if link:
                        curr_title = link.get_text(strip=True)
                        curr_url = link.get("href", "")
                    snippet = tr.select_one("td.result-snippet")
                    if snippet and curr_title:
                        text = snippet.get_text(strip=True)
                        if text:
                            # Chuẩn hóa link
                            actual_url = curr_url
                            if actual_url.startswith("//duckduckgo.com/l/?uddg="):
                                import urllib.parse
                                actual_url = urllib.parse.unquote(actual_url.split("uddg=")[-1].split("&")[0])

                            results.append({
                                "title": curr_title,
                                "snippet": text,
                                "url": actual_url,
                            })
                            curr_title = ""
                            if len(results) >= max_results:
                                break
    except Exception as e:
        logger.warning(f"Lỗi khi tìm kiếm web DuckDuckGo: {e}")

    # Fallback dự phòng: Wikipedia API nếu DuckDuckGo không có kết quả
    if not results:
        try:
            wiki_url = f"https://vi.wikipedia.org/w/api.php?action=query&list=search&srsearch={clean_query}&format=json&utf8=1&srlimit={max_results}"
            with httpx.Client(timeout=6.0) as client:
                r = client.get(wiki_url, headers={"User-Agent": USER_AGENT})
                if r.status_code == 200:
                    data = r.json()
                    for item in data.get("query", {}).get("search", []):
                        raw_snippet = item.get("snippet", "")
                        clean_snip = BeautifulSoup(raw_snippet, "html.parser").get_text()
                        page_id = item.get("pageid", "")
                        results.append({
                            "title": item.get("title", ""),
                            "snippet": clean_snip,
                            "url": f"https://vi.wikipedia.org/?curid={page_id}",
                        })
        except Exception as e:
            logger.warning(f"Lỗi khi tìm kiếm Wikipedia fallback: {e}")

    return results[:max_results]


def web_search_to_candidates(query: str, max_results: int = 4) -> list[EvidenceCandidate]:
    """Chuyển đổi kết quả tìm kiếm web thành danh sách EvidenceCandidate để đưa vào RAG pipeline."""
    raw_results = search_web(query, max_results=max_results)
    candidates: list[EvidenceCandidate] = []

    for idx, r in enumerate(raw_results, start=1):
        h = hashlib.md5(r["url"].encode("utf-8", errors="ignore")).hexdigest()[:8]
        chunk_id = f"web_{h}_{idx}"
        clean_title = re.sub(r"[^\w\s-]", "", r["title"])[:35].strip().replace(" ", "_")
        doc_id = f"WEB_{clean_title}" if clean_title else f"WEB_SEARCH_{idx}"

        candidates.append(
            EvidenceCandidate(
                chunk_id=chunk_id,
                doc_id=doc_id,
                text=f"【{r['title']}】: {r['snippet']}",
                source_url=r["url"],
                parent_path=["Web", r["title"][:40]],
                sparse_rank=idx,
                dense_rank=idx,
                rrf_score=1.0 / (idx + 10),
            )
        )

    return candidates
