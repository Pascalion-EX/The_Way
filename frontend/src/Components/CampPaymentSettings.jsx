import { useContext, useState } from "react";
import { toast } from "react-toastify";
import { AppContent } from "../Context/AppContent.js";
import axios from "../utils/axios";
import ImageUpload from "./ImageUpload.jsx";

export default function CampPaymentSettings({ camp, onUpdate }) {
  const { backendUrl } = useContext(AppContent);
  const [price, setPrice] = useState(String(camp.price ?? 0));
  const [qr, setQr] = useState(camp.paymentQrImage || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <details className="mt-6 rounded-2xl border border-gray-200 p-4 sm:p-5">
      <summary className="cursor-pointer font-semibold text-gray-900">Manage payment settings</summary>
      <form className="mt-4 space-y-4" onSubmit={async (event) => {
        event.preventDefault();
        if (saving || uploading) return;
        if (Number(price) > 0 && !qr) { toast.error("Upload a payment QR image for this paid trip."); return; }
        try {
          setSaving(true);
          const { data } = await axios.put(`${backendUrl}/api/camps/${camp._id}`, { price: Number(price), paymentQrImage: qr });
          if (!data.success) throw new Error(data.message || "Unable to save payment settings");
          onUpdate(data.camp);
          toast.success("Payment settings saved");
        } catch (error) {
          toast.error(error.response?.data?.message || error.message);
        } finally { setSaving(false); }
      }}>
        <fieldset disabled={saving} className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Price per applicant (EGP)
            <input type="number" min="0" max="1000000000" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-gray-300 px-4 outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>
          <p className="text-xs text-gray-500">Use 0 for a free trip.</p>
          <ImageUpload label="Payment QR code" value={qr} onChange={setQr} onUploadingChange={setUploading} required={Number(price) > 0} disabled={saving || uploading} />
          <button type="submit" disabled={saving || uploading} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "Saving..." : "Save payment settings"}
          </button>
        </fieldset>
      </form>
    </details>
  );
}
