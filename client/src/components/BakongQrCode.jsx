import { useEffect, useState } from "react";
import QRCode from "qrcode";

function BakongQrCode({ value, size = 184 }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;

    const renderCode = async () => {
      const nextValue = String(value || "").trim();
      if (!nextValue) {
        if (active) setSrc("");
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(nextValue, {
          width: size,
          margin: 1,
          color: {
            dark: "#B71C1C",
            light: "#FFF9F8",
          },
        });

        if (active) setSrc(dataUrl);
      } catch {
        if (active) setSrc("");
      }
    };

    renderCode();

    return () => {
      active = false;
    };
  }, [size, value]);

  if (!src) {
    return (
      <div className="flex items-center justify-center rounded-[24px] border border-red-100 bg-white p-6 text-sm text-slate-500">
        QR preview is not available.
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-red-100 bg-white p-4 shadow-[0_18px_38px_rgba(183,28,28,0.08)]">
      <img
        src={src}
        alt="Bakong KHQR payment code"
        className="h-full w-full rounded-[18px] bg-[#FFF9F8] object-contain"
      />
    </div>
  );
}

export default BakongQrCode;
