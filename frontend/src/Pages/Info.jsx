import React from "react";
import Navbar from "../Components/Navbar.jsx";
import Waves from "../Components/Waves.jsx";

const Info = () => {
  const informationCards = [
    {
      number: "01",
      title: "Your Mission",
      description:
        "To bring the kids to Church, and to help them grow into Christ, for death is terrifying and life is only available through Christ.",
    },
    {
      number: "02",
      title: "Your Vision",
      description:
        "To reach theosis is your only goal in life, helping the kids reach it, is the greatest honor a human can hold ",
    },
    {
      number: "03",
      title: "Our Community",
      description:
        "The Way brings together children, parents, servants, and leaders in one organized and supportive Community.",
    },
  ];

  const features = [
    {
      title: "Lessons",
      description:
        "Access organized spiritual lessons, presentations, videos, and activities for different school years.",
    },
    {
      title: "Activities",
      description:
        "Discover educational activities, group exercises, and creative ideas prepared by the service team.",
    },
    {
      title: "Games",
      description:
        "Browse interactive games with clear instructions, required materials, images, and videos.",
    },
    {
      title: "Chants",
      description:
        "View and present church chants in Arabic, Coptic, and English using presentation and projector modes.",
    },
    {
      title: "Trips and Camps",
      description:
        "Explore upcoming trips, camps, outings, and events and submit applications directly through the website.",
    },
    {
      title: "Service Planning",
      description:
        "Help leaders organize lessons, events, responsibilities, and the overall service calendar.",
    },
  ];
  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />

        <Waves
          lineColor="#e4b54f7e"
          backgroundColor="rgba(110, 110, 110, 0)"
          waveSpeedX={0.08}
          waveSpeedY={0.03}
          waveAmpX={60}
          waveAmpY={40}
          friction={0.9}
          tension={0.01}
          maxCursorMove={320}
          xGap={10}
          yGap={20}
        />
      </div>

      {/* Page content */}
      <div className="relative z-10">
        <Navbar />

        <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
          {/* Hero section */}
          <section className="flex min-h-[65vh] flex-col items-center justify-center text-center">
            <div className="mb-6 inline-flex items-center rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm">
              Duty of God's Servant fulfilled
            </div>

            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-gray-950 sm:text-5xl md:text-6xl lg:text-7xl">
              I am the way &
              <span className="block text-amber-600">the truth and the life</span>
            </h1>


            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                href="#about"
                className="rounded-xl bg-gray-950 px-7 py-3.5 text-sm font-bold text-white shadow-lg transition duration-300 hover:-translate-y-0.5 hover:bg-gray-800"
              >
                Learn more
              </a>

              <a
                href="#features"
                className="rounded-xl border border-gray-300 bg-white px-7 py-3.5 text-sm font-bold text-gray-800 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-amber-400"
              >
                Explore features
              </a>
            </div>
          </section>

          {/* About cards */}
          <section id="about" className="scroll-mt-28 py-16">
            <div className="mb-10 text-center">

              <h2 className="mt-3 text-3xl font-black text-gray-950 sm:text-4xl">
                Servants of theosis 
              </h2>

              <p className="mx-auto mt-4 max-w-xl leading-7 text-gray-800">
                  The platform was developed as a humble token of gratitude to the people I love in the Service of The Way.

                  Thank you for your unconditional love, acceptance, patience, and forgiveness.

                  It has been a wonderful journey and a great story, I will always be grateful for everything you have done for me.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {informationCards.map((card) => (
                <article
                  key={card.title}
                  className="group rounded-3xl border border-gray-200 bg-white p-7 shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-sm font-black text-amber-700">
                    {card.number}
                  </div>

                  <h3 className="text-xl font-black text-gray-950">
                    {card.title}
                  </h3>

                  <p className="mt-3 leading-7 text-gray-600">
                    {card.description}
                  </p>
                </article>
              ))}
            </div>
          </section>


          {/* Features */}
          <section id="features" className="scroll-mt-28 py-16">
            <div className="mb-10">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-amber-600">
                Platform features
              </p>

              <h2 className="mt-3 max-w-2xl text-3xl font-black text-gray-950 sm:text-4xl">
                Resources created for servants, children, and parents
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <article
                  key={feature.title}
                  className="rounded-3xl border border-gray-200 bg-white p-7 shadow-md transition duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-xl"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="text-3xl font-black text-gray-200">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="h-3 w-3 rounded-full bg-amber-500" />
                  </div>

                  <h3 className="text-xl font-black text-gray-950">
                    {feature.title}
                  </h3>

                  <p className="mt-3 leading-7 text-gray-600">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* Role section */}
          <section className="py-16">
            <div className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-xl sm:p-12">
              <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.25em] text-amber-600">
                    Secure access
                  </p>

                  <h2 className="mt-3 text-3xl font-black text-gray-950 sm:text-4xl">
                    A suitable experience for every role
                  </h2>

                  <p className="mt-5 leading-8 text-gray-600">
                    The website uses role-based permissions to control who can
                    view, create, update, and delete different types of content.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <RoleCard
                    title="Children and Parents"
                    description="View lessons, activities, chants, games, camps, and service announcements."
                  />

                  <RoleCard
                    title="Servants and Leaders"
                    description="Create educational content, organize events, and manage service resources."
                  />

                  <RoleCard
                    title="Pascals"
                    description="Prepare lessons, activities, plans, presentations, and resources."
                  />

                  <RoleCard
                    title="Administrators"
                    description="Manage users, permissions, content, and the overall platform."
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Final callout */}
          <section className="pb-10 pt-16">
            <div className="rounded-[2rem] border border-gray-200 bg-white text-center p-8 shadow-xl sm:p-12">              
              <div className="absolute left-0 top-0 h-52 w-52 rounded-full bg-amber-500/20 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-52 w-52 rounded-full bg-indigo-500/20 blur-3xl" />

              <div className="relative">
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-amber-400">
                  The Way Service
                </p>

                <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black sm:text-4xl">
                  Supporting the service through faith, organization, and
                  technology
                </h2>

                <p className="mx-auto mt-5 max-w-2xl leading-7 text-black-300">
                  Our goal is to make service resources easier to create,
                  organize, share, and access.
                </p>

                <a
                  href="/"
                  className="mt-8 inline-flex rounded-xl bg-amber-500 px-7 py-3.5 text-sm font-black text-gray-950 transition duration-300 hover:-translate-y-0.5 hover:bg-amber-400"
                >
                  Return to home
                </a>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-gray-200 bg-white/80 px-4 py-4 text-center text-sm text-gray-500 backdrop-blur-md">
          © {new Date().getFullYear()} The Way Service. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

const RoleCard = ({ title, description }) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 transition duration-300 hover:border-amber-300 hover:bg-white hover:shadow-md">
      <h3 className="font-black text-gray-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
    </div>
  );
};

export default Info;