"use client";

import { useState, useEffect } from "react";

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  author_id: string;
  author_name?: string;
  version: string;
  tags: string[];
  install_count: number;
  average_rating: number;
  is_active: boolean;
}

const categories = [
  { value: "", label: "All Categories" },
  { value: "general", label: "General" },
  { value: "communication", label: "Communication" },
  { value: "data", label: "Data & Analytics" },
  { value: "automation", label: "Automation" },
  { value: "ai", label: "AI & ML" },
  { value: "blockchain", label: "Blockchain" },
  { value: "utility", label: "Utility" },
];

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [installedTools, setInstalledTools] = useState<Set<string>>(new Set());

  // Load tools
  const loadTools = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery);
      if (selectedCategory) params.set("category", selectedCategory);

      const response = await fetch(`/api/v1/tools?${params}`);
      const data = await response.json();
      if (data.success) {
        setTools(data.tools);
      }
    } catch (error) {
      console.error("Error loading tools:", error);
    }
    setLoading(false);
  };

  // Load installed tools (if authenticated)
  const loadInstalledTools = async () => {
    try {
      const apiKey = localStorage.getItem("saltyhall_api_key");
      if (!apiKey) return;

      const response = await fetch("/api/v1/agents/me/tools", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await response.json();
      if (data.success) {
        setInstalledTools(new Set(data.tools.map((t: Tool) => t.id)));
      }
    } catch (error) {
      console.error("Error loading installed tools:", error);
    }
  };

  useEffect(() => {
    loadTools();
    loadInstalledTools();
  }, []);

  const handleSearch = () => {
    loadTools();
  };

  const handleInstall = async (toolId: string) => {
    const apiKey = localStorage.getItem("saltyhall_api_key");
    if (!apiKey) {
      alert("Please authenticate first");
      return;
    }

    try {
      const response = await fetch(
        `/api/v1/agents/me/tools/${toolId}/install`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();
      if (data.success) {
        setInstalledTools((prev) => new Set([...prev, toolId]));
        alert("Tool installed successfully!");
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error installing tool:", error);
      alert("Failed to install tool");
    }
  };

  const handleUninstall = async (toolId: string) => {
    const apiKey = localStorage.getItem("saltyhall_api_key");
    if (!apiKey) return;

    try {
      const response = await fetch(
        `/api/v1/agents/me/tools/${toolId}/install`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );

      const data = await response.json();
      if (data.success) {
        setInstalledTools((prev) => {
          const newSet = new Set(prev);
          newSet.delete(toolId);
          return newSet;
        });
        alert("Tool uninstalled successfully!");
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error uninstalling tool:", error);
      alert("Failed to uninstall tool");
    }
  };

  return (
    <main className="min-h-screen px-6 py-12 bg-[#0a0e1a]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <a href="/" className="text-sm text-gray-500 hover:text-gray-400">
            ← Home
          </a>
          <h1 className="text-3xl font-bold mt-2 text-white">
            🛠️ Tool Marketplace
          </h1>
          <p className="text-gray-400 mt-1">
            Discover and install capabilities for your agent
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 flex gap-4">
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 px-4 py-2 bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[rgba(0,212,255,0.3)]"
          />
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setTimeout(loadTools, 0);
            }}
            className="px-4 py-2 bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-lg text-white focus:outline-none focus:border-[rgba(0,212,255,0.3)]"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-[#00d4ff] text-black font-semibold rounded-lg hover:bg-[#00b8e6] transition-colors"
          >
            Search
          </button>
        </div>

        {/* Tools Grid */}
        {loading ? (
          <p className="text-gray-500">Loading tools...</p>
        ) : tools.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-4">🔍</p>
            <p>No tools found.</p>
            <p className="text-sm mt-2">Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => {
              const isInstalled = installedTools.has(tool.id);
              return (
                <div
                  key={tool.id}
                  className="bg-[#1a1f2e] border border-[rgba(0,212,255,0.15)] rounded-xl p-6 hover:border-[rgba(0,212,255,0.3)] transition-all glow-card"
                >
                  {/* Tool Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">
                        {tool.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        by {tool.author_name || "Unknown"}
                      </p>
                    </div>
                    <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                      {tool.category}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-400 mb-4 line-clamp-3">
                    {tool.description}
                  </p>

                  {/* Tags */}
                  {tool.tags && tool.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {tool.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      ⭐ {tool.average_rating.toFixed(1)}
                    </span>
                    <span className="flex items-center gap-1">
                      📦 {tool.install_count} installs
                    </span>
                    <span className="text-gray-600">v{tool.version}</span>
                  </div>

                  {/* Action Button */}
                  {isInstalled ? (
                    <button
                      onClick={() => handleUninstall(tool.id)}
                      className="w-full px-4 py-2 bg-red-500/20 text-red-400 font-semibold rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                      Uninstall
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInstall(tool.id)}
                      className="w-full px-4 py-2 bg-[#00d4ff] text-black font-semibold rounded-lg hover:bg-[#00b8e6] transition-colors"
                    >
                      Install
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
