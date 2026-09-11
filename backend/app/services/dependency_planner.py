"""module dependency_planner (TaiLieuKyThuat Muc 5.6) [BAT BUOC].

validate_and_toposort(query_plan): kiem tra DAG, tra ve thu tu topo de
hop_executor thuc thi. Hop chi duoc chay khi tat ca depends_on da hoan thanh.
"""
from __future__ import annotations

from ..schemas.query_plan import QueryPlan, SubQuestion


class CyclicQueryPlanError(Exception):
    pass


def validate_and_toposort(query_plan: QueryPlan) -> list[SubQuestion]:
    id_map = query_plan.as_id_map()
    if not query_plan.all_depends_on_valid():
        raise ValueError("depends_on tham chieu id khong ton tai trong query_plan")
    if not query_plan.is_acyclic():
        raise CyclicQueryPlanError("query_plan co cycle, khong the toposort")

    ordered: list[SubQuestion] = []
    done: set[str] = set()

    def visit(sq: SubQuestion, stack: set[str]):
        if sq.id in done:
            return
        if sq.id in stack:
            raise CyclicQueryPlanError(f"cycle tai {sq.id}")
        stack = stack | {sq.id}
        for dep_id in sq.depends_on:
            visit(id_map[dep_id], stack)
        ordered.append(sq)
        done.add(sq.id)

    for sq in query_plan.subquestions:
        visit(sq, set())
    return ordered


def independent_groups(ordered: list[SubQuestion]) -> list[list[SubQuestion]]:
    """Nhom cac hop co the chay song song: hop chi duoc dua vao nhom khi toan
    bo depends_on da co trong cac nhom truoc do (TaiLieuKyThuat 4.2)."""
    groups: list[list[SubQuestion]] = []
    done: set[str] = set()
    remaining = list(ordered)
    while remaining:
        ready = [sq for sq in remaining if all(dep in done for dep in sq.depends_on)]
        if not ready:
            raise CyclicQueryPlanError("khong the lap lich hop con lai (co the do cycle)")
        groups.append(ready)
        done.update(sq.id for sq in ready)
        remaining = [sq for sq in remaining if sq not in ready]
    return groups
