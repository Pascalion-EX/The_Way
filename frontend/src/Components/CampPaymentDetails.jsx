import ContentImage from "./ContentImage.jsx";
import { contentImageUrl } from "../utils/imageUrls.js";
import { formatCampPrice } from "../utils/campPrice.js";

export default function CampPaymentDetails({ camp }) {
  return (
    <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 sm:p-5" aria-label="Trip payment">
      <p className="text-sm font-medium text-gray-600">Price per applicant</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{formatCampPrice(camp.price)}</p>
      {camp.price > 0 && (
        <>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            Scan the QR code to pay, then attach a screenshot of the completed payment when applying for your child.
          </p>
          {camp.paymentQrImage ? (
            <a href={contentImageUrl(camp.paymentQrImage)} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-xl bg-white p-3">
              <ContentImage src={camp.paymentQrImage} alt="Payment QR code — open full size" className="h-52 w-52 object-contain" />
              <span className="mt-2 block text-center text-sm font-medium text-indigo-700">Open QR code</span>
            </a>
          ) : <p className="mt-3 text-sm text-amber-700">Contact the trip team for payment instructions.</p>}
        </>
      )}
    </section>
  );
}
