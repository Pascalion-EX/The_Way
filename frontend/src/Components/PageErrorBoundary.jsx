import { Component } from "react";

export default class PageErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-indigo-50 px-6">
        <div role="alert" className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">This page couldn’t load</h1>
          <p className="mt-3 text-gray-600">Check your connection and reload to get the latest version of The Way.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700">
            Reload page
          </button>
          <a href="/" className="mt-4 block text-sm text-indigo-700 underline">Return home</a>
        </div>
      </main>
    );
  }
}
