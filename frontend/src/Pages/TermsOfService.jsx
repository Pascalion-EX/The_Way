import { useEffect } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { TERMS_VERSION } from "../../../shared/termsOfService.mjs";

const linkClass = "font-semibold text-amber-800 underline decoration-amber-300 underline-offset-4 hover:text-amber-950 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600";
const sections = [
  {
    id: "agreement",
    title: "About these terms",
    content: <p>The Way Service provides website tools for our church community, including learning resources, attendance, activities, and trip or camp registrations. By selecting the agreement checkbox and creating an account, you agree to these Terms of Service. You can read the terms and our privacy policy without an account.</p>,
  },
  {
    id: "accounts",
    title: "Accounts and family permissions",
    content: (
      <>
        <p>Provide accurate account information, use your own email address, and keep your password private. Use only the account and service permissions assigned to you. Tell us if you believe someone is using your account without permission.</p>
        <p>If you are not old enough to enter into an agreement under the law that applies to you, a parent or guardian must review and agree to these terms and supervise your use. Parents, guardians, and service staff must have appropriate authority before submitting information about a child or another person.</p>
      </>
    ),
  },
  {
    id: "conduct",
    title: "Respectful and authorised use",
    content: (
      <>
        <p>Use the website lawfully and respectfully. You must not:</p>
        <ul className="list-disc space-y-3 pl-5 marker:text-amber-600">
          <li>Harass, threaten, impersonate, or harm another person, or submit abusive or unlawful content.</li>
          <li>Access records or tools you are not authorised to use, bypass account restrictions, or share another person&apos;s private information without permission.</li>
          <li>Upload malicious files, send spam, interfere with the website, or attempt to compromise accounts or systems.</li>
          <li>Copy, upload, or distribute material without the rights or permission needed to do so.</li>
        </ul>
      </>
    ),
  },
  {
    id: "content",
    title: "Content and learning resources",
    content: (
      <>
        <p>You keep any rights you hold in content you submit. By submitting content, you permit The Way Service to store, process, back up, and display it as needed to provide the website and the service activities for which it was submitted. This permission does not transfer ownership of your content.</p>
        <p>Resources may belong to their authors, the church, or external providers. Access to a resource does not automatically give permission to republish it or use it commercially. Respect any permissions or notices attached to the material.</p>
      </>
    ),
  },
  {
    id: "activities",
    title: "Activities, trips, and camps",
    content: <p>Website information and registrations help the service team organise activities. Participation may require separate confirmation, parent or guardian permission, or arrangements communicated by the organisers. Confirm important dates, attendance arrangements, and any safety or allergy information directly with the responsible service team.</p>,
  },
  {
    id: "privacy",
    title: "Privacy and external services",
    content: (
      <>
        <p>Our <Link to="/privacy-policy" className={linkClass}>Privacy Policy</Link> explains the information we handle, who can access it, cookies, backups, retention, and how to make a privacy request. We record the terms version and the date you accept it when your account is created.</p>
        <p>The website may display media or link to services operated by others. Those services have their own terms and privacy practices. We do not operate or control their websites.</p>
      </>
    ),
  },
  {
    id: "availability",
    title: "Availability and access restrictions",
    content: (
      <>
        <p>We aim to keep the website useful and available, but maintenance, errors, or interruptions can occur. Features and resources may change as the needs of the service change. Report errors or access problems using the contact below.</p>
        <p>We may restrict access to protect the community, investigate misuse, enforce account permissions, or address a breach of these terms. If you think a restriction is a mistake, contact us so the service team can review it. You may stop using the website and request account closure at any time.</p>
        <p>Nothing in these terms removes rights or responsibilities that applicable law does not allow to be excluded or limited.</p>
      </>
    ),
  },
];

export default function TermsOfService() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Terms of Service | The Way Service";
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-amber-100 bg-white/80 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-3 rounded-lg font-bold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600">
            <img src="/waylogo.svg" alt="" width="44" height="44" className="h-11 w-11 object-contain" />
            The Way Service
          </Link>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <article aria-labelledby="terms-title" className="overflow-hidden rounded-3xl border border-gray-200 bg-white/95 shadow-sm">
          <div className="border-b border-amber-100 bg-amber-50/70 px-6 py-8 sm:px-10 sm:py-10">
            <div className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-amber-800">
              <FileText size={20} aria-hidden="true" />
              Our community agreement
            </div>
            <h1 id="terms-title" className="text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">Terms of Service</h1>
            <p className="mt-3 text-sm text-gray-600">Effective date: <time dateTime={TERMS_VERSION}>3 November 2026</time></p>
            <p className="mt-6 max-w-3xl leading-7 text-gray-700">Please read these terms before creating an account. They explain how to use The Way Service and what we ask of everyone in our community.</p>
          </div>

          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <nav aria-label="Terms of Service sections" className="mb-10 rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <p className="mb-3 text-sm font-bold text-gray-900">On this page</p>
              <ul className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {sections.map(({ id, title }) => <li key={id}><a href={`#${id}`} className={linkClass}>{title}</a></li>)}
                <li><a href="#contact" className={linkClass}>Contact and updates</a></li>
              </ul>
            </nav>

            <div className="space-y-10 text-gray-700">
              {sections.map(({ id, title, content }) => (
                <section key={id} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8">
                  <h2 id={`${id}-title`} className="mb-4 text-xl font-bold text-gray-950">{title}</h2>
                  <div className="space-y-4 leading-7">{content}</div>
                </section>
              ))}
              <section id="contact" aria-labelledby="contact-title" className="scroll-mt-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
                <h2 id="contact-title" className="mb-4 text-xl font-bold text-gray-950">Contact and updates</h2>
                <p className="leading-7">Questions, account closure requests, or concerns about these terms can be sent to The Way Service at <a href="mailto:kerolos.a.fam@gmail.com" className={`${linkClass} break-words`}>kerolos.a.fam@gmail.com</a>.</p>
                <p className="mt-4 leading-7">Updates to these terms will be published on this page with a revised date and version. The version accepted at sign-up is recorded with your account.</p>
                <p className="mt-4 text-sm text-gray-600">Terms version: {TERMS_VERSION}</p>
              </section>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
