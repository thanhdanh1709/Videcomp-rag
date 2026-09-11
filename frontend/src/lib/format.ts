/** "12,4 giây" cho dưới 60s, "2 phút 5 giây" cho lâu hơn — dễ đọc hơn số ms
 * thô, giống cách ChatGPT hiển thị "Thought for Xs". */
export function formatDuration(ms: number): string {
  const totalSec = ms / 1000;
  if (totalSec < 60) {
    return `${totalSec.toFixed(1).replace(".", ",")} giây`;
  }
  const min = Math.floor(totalSec / 60);
  const sec = Math.round(totalSec % 60);
  return `${min} phút ${sec} giây`;
}
