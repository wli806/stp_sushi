"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2, AlertTriangle, ExternalLink, RotateCcw, Package, Copy, Check, Camera } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

const OSS_BASE = "https://oss.spientsyserv.com";
const OSS_GR_URL = `${OSS_BASE}/shop/home/goodsreceiving_view`;

interface InvoiceItem { code: string | null; name: string; cartonsOrdered: number; cartonsDelivered: number; quantity: number; unit: string; }
interface OrderItem { id: string; itemCode: string; itemName: string; quantity: number; uom: string; }
interface InvoiceData {
  poNumber: string | null;
  invoiceNumber: string | null;
  supplierName: string | null;
  deliveryDate: string | null;
  items: InvoiceItem[];
}
interface MatchedOrder {
  id: string; ossId: string; poNumber: string; supplierName: string;
  status: number; deliveryDate: string | null; orderDate: string | null; weekNo: number | null;
  items: OrderItem[];
}

interface CompareRow {
  orderItem: OrderItem | null;
  invoiceItem: InvoiceItem | null;
  match: "full" | "partial" | "extra" | "missing";
  diff: number;
}

function buildComparison(order: MatchedOrder, invoice: InvoiceData): CompareRow[] {
  const rows: CompareRow[] = [];
  const usedInvoice = new Set<number>();

  for (const oi of order.items) {
    // Find best matching invoice item by name similarity
    let bestIdx = -1;
    let bestScore = 0;
    invoice.items.forEach((ii, idx) => {
      if (usedInvoice.has(idx)) return;
      const oName = oi.itemName.toLowerCase();
      const iName = ii.name.toLowerCase();
      const score = oName.includes(iName.slice(0, 4)) || iName.includes(oName.slice(0, 4)) ? 1 : 0;
      if (score > bestScore || (score === bestScore && oi.itemCode && ii.code?.includes(oi.itemCode))) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    if (bestIdx >= 0) {
      usedInvoice.add(bestIdx);
      const ii = invoice.items[bestIdx];
      const diff = ii.quantity - oi.quantity;
      rows.push({ orderItem: oi, invoiceItem: ii, match: Math.abs(diff) < 0.01 ? "full" : "partial", diff });
    } else {
      rows.push({ orderItem: oi, invoiceItem: null, match: "missing", diff: -oi.quantity });
    }
  }

  // Extra items on invoice not in order
  invoice.items.forEach((ii, idx) => {
    if (!usedInvoice.has(idx)) {
      rows.push({ orderItem: null, invoiceItem: ii, match: "extra", diff: ii.quantity });
    }
  });
  return rows;
}

export default function GoodsReceivingPage() {
  const { lang } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState("image/jpeg");
  const [analyzing, setAnalyzing] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [order, setOrder] = useState<MatchedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function fallbackCopy(val: string) {
    const el = document.createElement("textarea");
    el.value = val;
    el.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.appendChild(el);
    el.focus();
    el.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
    document.body.removeChild(el);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyInvoiceNo(val: string) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(val)
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
        .catch(() => fallbackCopy(val));
    } else {
      fallbackCopy(val);
    }
  }

  function openOSS(poNumber?: string | null) {
    if (poNumber) fallbackCopy(poNumber);
    window.open(OSS_GR_URL, "_blank", "noopener,noreferrer");
  }

  function readFile(file: File) {
    const mt = file.type || "image/jpeg";
    setMediaType(mt);
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      // Strip data URL prefix to get raw base64
      const b64 = dataUrl.split(",")[1];
      setImageBase64(b64);
    };
    reader.readAsDataURL(file);
  }

  function handleFile(file: File) {
    setInvoice(null);
    setOrder(null);
    setError(null);
    readFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleAnalyze() {
    if (!imageBase64) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/sushi/goods-receiving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setInvoice(data.invoice);
      setOrder(data.order ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    setImagePreview(null);
    setImageBase64(null);
    setInvoice(null);
    setOrder(null);
    setError(null);
  }

  const comparison = invoice && order ? buildComparison(order, invoice) : null;
  const allFull = comparison?.every(r => r.match === "full");

  const ossUrl = order ? OSS_GR_URL : `${OSS_BASE}/shop/home/module_list`;

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">
            {lang === "en" ? "Goods Receiving" : "收货管理"}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {lang === "en" ? "Upload an invoice to auto-match with orders" : "上传发票自动匹配订单，对比数量"}
          </p>
        </div>
        {imagePreview && (
          <button onClick={reset} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 flex-shrink-0">
            <RotateCcw size={14} /> {lang === "en" ? "Reset" : "重置"}
          </button>
        )}
      </div>

      {/* Upload zone */}
      {!imagePreview && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${dragging ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:border-orange-300 hover:bg-orange-50/40"}`}
        >
          <Upload size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium mb-1">{lang === "en" ? "Drop invoice image here" : "拖拽发票图片到这里"}</p>
          <p className="text-slate-400 text-sm">{lang === "en" ? "or click to select · JPG, PNG, WEBP" : "或点击选择文件 · JPG、PNG、WEBP"}</p>
          <div className="flex items-center justify-center gap-3 mt-5" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium shadow-sm transition-colors"
            >
              <Upload size={15} />
              {lang === "en" ? "Choose File" : "选择文件"}
            </button>
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium shadow-sm transition-colors"
            >
              <Camera size={15} />
              {lang === "en" ? "Take Photo" : "拍照"}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {/* Image preview + analyze */}
      {imagePreview && !invoice && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="relative">
            <img src={imagePreview} alt="Invoice" className="w-full max-h-96 object-contain bg-slate-50" />
          </div>
          <div className="p-4 flex justify-end">
            <button onClick={handleAnalyze} disabled={analyzing}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-5 py-2.5 rounded-xl font-medium transition-colors">
              {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
              {analyzing ? (lang === "en" ? "Analyzing..." : "识别中...") : (lang === "en" ? "Analyze Invoice" : "识别发票")}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Results */}
      {invoice && (
        <div className="space-y-4 mt-2">
          {/* Invoice summary */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <h2 className="font-semibold text-slate-700 mb-3 text-sm">{lang === "en" ? "Extracted from Invoice" : "从发票识别到的信息"}</h2>
            {invoice.invoiceNumber && (
              <div className="flex items-center gap-2 mb-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-orange-500 font-medium">Invoice No. <span className="text-slate-400 font-normal">({lang === "en" ? "enter this in OSS confirmation" : "填入 OSS 确认单"})</span></p>
                  <p className="font-bold text-slate-800 text-base tracking-wide">{invoice.invoiceNumber}</p>
                </div>
                <button
                  onClick={() => copyInvoiceNo(invoice.invoiceNumber!)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors flex-shrink-0"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? (lang === "en" ? "Copied" : "已复制") : (lang === "en" ? "Copy" : "复制")}
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">PO #</p>
                {invoice.poNumber ? (
                  <button
                    onClick={() => openOSS(invoice.poNumber)}
                    title={lang === "en" ? "Copy PO# & open OSS Goods Receiving" : "复制 PO# 并打开 OSS 收货页"}
                    className="font-semibold text-orange-600 hover:text-orange-700 underline underline-offset-2 flex items-center gap-1"
                  >
                    {invoice.poNumber}
                    <ExternalLink size={11} className="flex-shrink-0" />
                  </button>
                ) : <p className="font-semibold text-slate-800">—</p>}
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">{lang === "en" ? "Supplier" : "供应商"}</p>
                <p className="font-semibold text-slate-800 truncate">{invoice.supplierName ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">{lang === "en" ? "Delivery Date" : "送货日期"}</p>
                <p className="font-semibold text-slate-800">{invoice.deliveryDate ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">{lang === "en" ? "Items" : "商品数"}</p>
                <p className="font-semibold text-slate-800">{invoice.items.length}</p>
              </div>
            </div>
            {invoice.items.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-400 mb-2">{lang === "en" ? "Recognised items" : "识别到的商品"}</p>
                <div className="space-y-1">
                  {invoice.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.code && <span className="text-slate-400 font-mono flex-shrink-0">{item.code}</span>}
                        <span className="text-slate-700 truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-2 text-slate-500">
                        {item.cartonsDelivered > 0 && <span>{item.cartonsDelivered} CTN</span>}
                        {item.quantity > 0 && <span className="font-medium text-slate-700">{item.quantity} {item.unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Order match */}
          {!order && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-amber-700">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span>{lang === "en" ? "No matching order found in local DB. Check PO# and try syncing first." : "本地数据库未找到匹配订单，请先同步 OSS 数据后重试。"}</span>
            </div>
          )}

          {order && (
            <>
              {/* Matched order header */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="font-semibold text-slate-700 text-sm mb-1">{lang === "en" ? "Matched Order" : "匹配到的订单"}</h2>
                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span className="font-medium text-slate-600">{order.supplierName}</span>
                      {order.poNumber && <span>PO: {order.poNumber}</span>}
                      {order.weekNo && <span>W{order.weekNo}</span>}
                      {order.deliveryDate && <span>{lang === "en" ? "Delivery:" : "配送:"} {order.deliveryDate}</span>}
                    </div>
                  </div>
                  <button onClick={() => openOSS(order?.poNumber)}
                    className="flex items-center gap-1.5 text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors flex-shrink-0">
                    <ExternalLink size={12} />
                    {lang === "en" ? "Copy PO# & Open OSS" : "复制 PO# 并打开 OSS"}
                  </button>
                </div>
              </div>

              {/* Comparison table */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-700 text-sm">{lang === "en" ? "Quantity Comparison" : "数量对比"}</h2>
                  {allFull
                    ? <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium"><CheckCircle2 size={14} />{lang === "en" ? "All match — select Full" : "全部匹配 — 选择 Full"}</span>
                    : <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium"><AlertTriangle size={14} />{lang === "en" ? "Discrepancies found" : "存在数量差异"}</span>
                  }
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="text-xs text-slate-400 border-b border-slate-100">
                        <th className="text-left px-4 py-2.5 font-medium">{lang === "en" ? "Item" : "商品"}</th>
                        <th className="text-right px-4 py-2.5 font-medium">{lang === "en" ? "Ordered" : "订单数量"}</th>
                        <th className="text-right px-4 py-2.5 font-medium">{lang === "en" ? "Invoice" : "发票数量"}</th>
                        <th className="text-center px-4 py-2.5 font-medium">{lang === "en" ? "Action" : "操作建议"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {comparison!.map((row, i) => (
                        <tr key={i} className={row.match === "full" ? "" : "bg-amber-50/50"}>
                          <td className="px-4 py-3">
                            <p className="text-slate-700 font-medium leading-snug">
                              {row.orderItem?.itemName ?? row.invoiceItem?.name}
                            </p>
                            {row.orderItem?.itemCode && (
                              <p className="text-xs text-slate-400">{row.orderItem.itemCode}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">
                            {row.orderItem ? `${row.orderItem.quantity} ${row.orderItem.uom}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">
                            {row.invoiceItem ? (
                              <span className={row.match === "full" ? "text-slate-800" : "text-amber-700"}>
                                {row.invoiceItem.quantity} {row.invoiceItem.unit}
                              </span>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.match === "full" && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                                <CheckCircle2 size={11} /> Full
                              </span>
                            )}
                            {row.match === "partial" && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                                <AlertTriangle size={11} /> Change QTY → {row.invoiceItem!.quantity}
                              </span>
                            )}
                            {row.match === "missing" && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                                None
                              </span>
                            )}
                            {row.match === "extra" && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                                {lang === "en" ? "Not in order" : "订单中无此项"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary action */}
                <div className="px-4 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <p className="text-xs text-slate-400">
                    {lang === "en"
                      ? "Review the comparison above, then go to OSS Goods Receiving to confirm receipt."
                      : "对比完成后，前往 OSS 收货模块，按建议操作 Full / Change QTY。"}
                  </p>
                  <button onClick={() => openOSS(order?.poNumber)}
                    className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-colors flex-shrink-0 ${
                      allFull
                        ? "bg-green-500 hover:bg-green-600 text-white"
                        : "bg-amber-500 hover:bg-amber-600 text-white"
                    }`}>
                    <ExternalLink size={14} />
                    {lang === "en" ? "Copy PO# & Go to OSS" : "复制 PO# 并前往 OSS"}
                  </button>
                </div>
              </div>

              {/* Image thumbnail */}
              {imagePreview && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3">
                  <p className="text-xs text-slate-400 mb-2">{lang === "en" ? "Uploaded invoice" : "已上传发票"}</p>
                  <img src={imagePreview} alt="Invoice" className="max-h-48 object-contain rounded-lg bg-slate-50 w-full" />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
