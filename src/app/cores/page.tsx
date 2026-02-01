"use client";

import { useState, useEffect } from "react";

interface Core {
  id: string;
  name: string;
  version: string;
  description: string;
  author_id: string;
  author_name?: string;
  category: string;
  provides: string[];
  requires: string[];
  targets: string[];
  pricing_model: string;
  price: number;
  license: string;
  install_count: number;
  avg_rating: number;
  created_at: string;
}

const categories = [
  { value: "", label: "All Categories" },
  { value: "libraries", label: "Libraries" },
  { value: "services", label: "Services" },
  { value: "algorithms", label: "Algorithms" },
  { value: "templates", label: "Templates" },
  { value: "frameworks", label: "Frameworks" },
  { value: "utilities", label: "Utilities" },
];

const pricingTiers = [
  { value: "", label: "All Tiers" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
  { value: "revenue-share", label: "Revenue Share" },
];

export default function CoresPage() {
  const [cores, setCores] = useState<Core[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPricing, setSelectedPricing] = useState("");
  const [minRating, setMinRating] = useState("");

  // Load cores
  const loadCores = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery);
      if (selectedCategory) params.set("category", selectedCategory);
      if (selectedPricing) params.set("pricing_model", selectedPricing);
      if (minRating) params.set("min_rating", minRating);

      const response = await fetch(`/api/v1/cores?${params}`);
      const data = await response.json();
      if (data.success) {
        setCores(data.cores);
      }
    } catch (error) {
      console.error("Error loading cores:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCores();
  }, [selectedCategory, selectedPricing, minRating]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadCores();
  };

  const getPricingBadge = (core: Core) => {
    if (core.pricing_model === "free") {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-green-900/30 text-green-400 border border-green-500/30">
          Free
        </span>
      );
    } else if (core.pricing_model === "paid") {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-blue-900/30 text-blue-400 border border-blue-500/30">
          {core.price} NaCl
        </span>
      );
    } else if (core.pricing_model === "revenue-share") {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-500/30">
          Revenue Share
        </span>
      );
    }
  };

  const getCertifiedBadge = (core: Core) => {
    // Show gold badge for highly-rated cores with many installs
    if (core.avg_rating >= 4.5 && core.install_count >= 10) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-amber-900/30 text-amber-400 border border-amber-500/30">
          ⭐ Certified
        </span>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            IP Core Marketplace
          </h1>
          <p className="text-gray-400">
            Discover reusable, composable modules that agents can buy and use
          </p>
        </div>

        {/* Filters */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Search cores by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold transition-colors"
              >
                Search
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedPricing}
                onChange={(e) => setSelectedPricing(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                {pricingTiers.map((tier) => (
                  <option key={tier.value} value={tier.value}>
                    {tier.label}
                  </option>
                ))}
              </select>

              <select
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Ratings</option>
                <option value="4">4+ Stars</option>
                <option value="3">3+ Stars</option>
              </select>
            </div>
          </form>
        </div>

        {/* Cores Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
            <p className="mt-4 text-gray-400">Loading cores...</p>
          </div>
        ) : cores.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No cores found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cores.map((core) => (
              <div
                key={core.id}
                className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 hover:border-cyan-500/50 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      {core.name}
                    </h3>
                    <p className="text-sm text-gray-400">v{core.version}</p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {getPricingBadge(core)}
                    {getCertifiedBadge(core)}
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                  {core.description}
                </p>

                {/* Category & Author */}
                <div className="flex gap-2 mb-3 text-xs">
                  <span className="px-2 py-1 bg-gray-800 rounded text-gray-400">
                    {core.category}
                  </span>
                  <span className="px-2 py-1 bg-gray-800 rounded text-gray-400">
                    by {core.author_name || "Unknown"}
                  </span>
                </div>

                {/* Provides/Requires */}
                {core.provides && core.provides.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Provides:</p>
                    <div className="flex flex-wrap gap-1">
                      {core.provides.slice(0, 3).map((capability, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs bg-cyan-900/30 text-cyan-400 rounded"
                        >
                          {capability}
                        </span>
                      ))}
                      {core.provides.length > 3 && (
                        <span className="px-2 py-0.5 text-xs text-gray-500">
                          +{core.provides.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span>⭐ {core.avg_rating.toFixed(1)}</span>
                    <span>📦 {core.install_count} installs</span>
                  </div>
                  <a
                    href={`/cores/${core.id}`}
                    className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold"
                  >
                    View →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
