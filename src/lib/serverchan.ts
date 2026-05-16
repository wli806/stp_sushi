export async function wxNotify(title: string, desp?: string): Promise<{ ok: boolean; msg: string }> {
  const key = process.env.SERVERCHAN_KEY;
  if (!key) return { ok: false, msg: "SERVERCHAN_KEY 未配置" };
  try {
    const res = await fetch(`https://sctapi.ftqq.com/${key}.send`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ title, ...(desp ? { desp } : {}) }),
    });
    const json = await res.json().catch(() => ({}));
    if (json?.code !== 0) return { ok: false, msg: JSON.stringify(json) };
    return { ok: true, msg: "ok" };
  } catch (e) {
    return { ok: false, msg: String(e) };
  }
}
