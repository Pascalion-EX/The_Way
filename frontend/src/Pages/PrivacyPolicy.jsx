import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

const contactEmail = "kerolos.a.fam@gmail.com";
const linkClass = "font-semibold text-amber-800 underline decoration-amber-300 underline-offset-4 hover:text-amber-950 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600";

const sections = [
  {
    id: "information",
    title: "Information we handle",
    content: (
      <>
        <p>Depending on the features you use, we handle:</p>
        <ul className="list-disc space-y-3 pl-5 marker:text-amber-600">
          <li><strong>Account details:</strong> your name, email address, phone number, sign-in details, avatar choice, service role, school year, email preferences, and the terms version and date accepted when you sign up.</li>
          <li><strong>Child and family details:</strong> names, school grades, parent or guardian names, occupations, contact numbers, addresses, and allergy information entered by families or authorised service staff.</li>
          <li><strong>Service records:</strong> attendance, attendance notes, trip and camp registrations, and information submitted in video requests or other service content.</li>
          <li><strong>Technical and security information:</strong> network information used to prevent abuse, sign-in and access records, request timings, and errors needed to operate the website.</li>
        </ul>
        <p>Church attendance and service records can reveal participation in a religious community. Allergy information is health information. Please share only details needed for the service.</p>
      </>
    ),
  },
  {
    id: "purposes",
    title: "How we use information",
    content: (
      <p>
        We use information to create and protect accounts, manage access to service tools,
        organise lessons and activities, keep attendance and registration records, support
        children and families, respond to requests, and maintain the website. We also use
        your email address for account verification, password resets, security notices,
        and service updates according to your email preferences.
      </p>
    ),
  },
  {
    id: "access",
    title: "Who can access information",
    content: (
      <>
        <p>
          Authorised service servants, staff, and administrators can access records according
          to their roles. Hosting and email providers process information needed to run
          the website and deliver messages. When Google Drive backups are enabled,
          database records and uploaded images are included in those backups.
        </p>
        <p>
          Uploaded content images are accessible to anyone with their image URL, even
          when the page using the image requires sign-in. Other service records are
          subject to the website&apos;s account and role restrictions.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and external services",
    content: (
      <>
        <p>
          We use a sign-in cookie that lasts up to two days and is cleared when you sign
          out. The website also uses browser session storage to help recover from page
          loading errors after updates. You can clear cookies and browser storage in
          your browser settings; blocking the sign-in cookie prevents account access.
        </p>
        <p>
          The website loads Google Fonts, and some pages display YouTube or Pinterest
          media or link to other websites. Loading external resources sends information
          such as your IP address and browser details to the provider. Embedded media
          may also use that provider&apos;s cookies or similar technologies. These services
          have their own privacy practices: see the{" "}
          <a className={linkClass} href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>
          {" "}and the{" "}
          <a className={linkClass} href="https://policy.pinterest.com/en/privacy-policy" target="_blank" rel="noopener noreferrer">Pinterest Privacy Policy</a>.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "Storage, security, and retention",
    content: (
      <>
        <p>
          We use password hashing, protected sign-in cookies, and role-based access
          controls to help protect information. Keep your password private and sign
          out when using a shared device.
        </p>
        <p>
          Account, child profile, attendance, and activity records remain stored until
          removed by an authorised administrator; they do not currently have an
          automatic deletion schedule. Local backup retention depends on the backup
          settings. Off-site backups may remain until manually removed, and backups
          can contain earlier copies of information that has been changed or deleted
          from the live site. Contact us to discuss a record or its retention.
        </p>
        <p>
          Hosting, email, backup, and external media providers may process information
          in countries other than your own.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children and families",
    content: (
      <p>
        The Way Service supports a church community that includes children. Child
        and family details should be provided by a parent, guardian, or authorised
        service staff member with appropriate permission. A parent or guardian can
        contact us about their child&apos;s information. If you are a young person and
        have a privacy concern, you can email us or ask a trusted adult to help.
      </p>
    ),
  },
  {
    id: "choices",
    title: "Your choices and requests",
    content: (
      <>
        <p>
          You can update available account details and optional email preferences in
          your profile. Optional emails also include an unsubscribe link. Account
          verification, password reset, and security messages continue when needed
          to operate your account.
        </p>
        <p>
          You can ask us to access, correct, or delete information about you, or raise
          a concern about how it is used. Email us using the contact below; you do
          not need a website account to make a request. We may need to confirm your
          identity or authority to act for a child before sharing or changing records.
          Requests are considered in light of applicable law and any information we
          need to retain for service administration or safeguarding.
        </p>
      </>
    ),
  },
];

export default function PrivacyPolicy() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Privacy Policy | The Way Service";
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
        <article aria-labelledby="privacy-title" className="overflow-hidden rounded-3xl border border-gray-200 bg-white/95 shadow-sm">
          <div className="border-b border-amber-100 bg-amber-50/70 px-6 py-8 sm:px-10 sm:py-10">
            <div className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-amber-800">
              <ShieldCheck size={20} aria-hidden="true" />
              Your information, explained
            </div>
            <h1 id="privacy-title" className="text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">Privacy Policy</h1>
            <p className="mt-3 text-sm text-gray-600">Last updated: <time dateTime="2026-11-03">3 November 2026</time></p>
            <p className="mt-6 max-w-3xl leading-7 text-gray-700">
              The Way Service provides tools for our church community. This policy
              explains what information the website handles, why it is used, and how
              to contact us. Everyone can read this page without signing in.
            </p>
          </div>

          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <nav aria-label="Privacy policy sections" className="mb-10 rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <p className="mb-3 text-sm font-bold text-gray-900">On this page</p>
              <ul className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {sections.map(({ id, title }) => (
                  <li key={id}><a href={`#${id}`} className={linkClass}>{title}</a></li>
                ))}
                <li><a href="#contact" className={linkClass}>Contact and policy updates</a></li>
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
                <h2 id="contact-title" className="mb-4 text-xl font-bold text-gray-950">Contact and policy updates</h2>
                <p className="leading-7">
                  For privacy questions or information requests, contact The Way Service at{" "}
                  <a href={`mailto:${contactEmail}`} className={`${linkClass} break-words`}>{contactEmail}</a>.
                </p>
                <p className="mt-4 leading-7">
                  We will update this page when our practices change and revise the
                  date above. Please check this page for the latest version.
                </p>
              </section>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
