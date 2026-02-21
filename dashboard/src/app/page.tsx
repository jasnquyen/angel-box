
import { FaCamera, FaShieldAlt, FaCog } from "react-icons/fa";

export default function Home() {
  return (
    <div className="flex min-h-screen bg-[#f5f7fa] font-sans">
      {/* Sidebar */}
      <aside className="w-[400px] bg-[#1769e0] text-white flex flex-col justify-between min-h-screen shadow-lg">
        <div>
          <div className="flex items-center gap-4 px-8 py-8">
            <div className="bg-[#ffe066] rounded-full p-3">
              <FaShieldAlt className="text-[#1769e0] text-2xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Angel Box</h2>
              <p className="text-sm">Atlanta Police Department</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-8 py-2">
            <span className="h-3 w-3 bg-green-400 rounded-full" />
            <span className="text-sm">Live Camera Network Active</span>
          </div>
          <div className="px-8 py-6">
            <div className="mb-4">
              <input
                className="w-full rounded-lg border border-gray-200 px-4 py-3 mb-3 text-black focus:outline-none"
                placeholder="Choose starting point"
                type="text"
              />
              <input
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-black focus:outline-none"
                placeholder="Choose destination"
                type="text"
              />
            </div>
            <button className="w-full bg-[#1769e0] hover:bg-[#155bb5] text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 text-lg shadow-md">
              <span>&#9992;</span> Find Safest Routes
            </button>
          </div>
          <div className="px-8 py-6">
            <div className="bg-[#eaf0fa] rounded-lg p-4 mb-4">
              <div className="text-3xl font-bold text-[#1769e0]">1,247</div>
              <div className="text-sm text-[#1769e0]">Active Cameras</div>
            </div>
            <div className="bg-[#eaf0fa] rounded-lg p-4 mb-4">
              <div className="text-3xl font-bold text-[#2ecc40]">89%</div>
              <div className="text-sm text-[#1769e0]">City Coverage</div>
            </div>
            <div className="bg-[#fff9e5] rounded-lg p-4">
              <div className="text-3xl font-bold text-[#ffb300]">24/7</div>
              <div className="text-sm text-[#1769e0]">Monitoring</div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-8 py-4 text-xs text-white">
          <span>© 2026 Atlanta PD</span>
          <button className="flex items-center gap-2 hover:text-[#ffe066]">
            <FaCog /> Settings
          </button>
        </div>
      </aside>

      {/* Main Map Area */}
      <main className="flex-1 relative">
        {/* Map grid background */}
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full grid grid-cols-12 grid-rows-8 gap-0">
            {[...Array(96)].map((_, i) => (
              <div key={i} className="border border-gray-200 h-full" />
            ))}
          </div>
        </div>
        {/* Camera icons */}
        <div className="absolute inset-0 z-10">
          {/* Example camera positions */}
          {/* You can replace these with dynamic positions */}
          <div className="absolute top-[10%] left-[20%]">
            <div className="flex items-center gap-1">
              <FaCamera className="text-blue-500 text-xl" />
              <span className="bg-yellow-400 text-blue-700 font-bold rounded-full px-2">A</span>
            </div>
          </div>
          <div className="absolute top-[50%] left-[60%]">
            <div className="flex items-center gap-1">
              <FaCamera className="text-blue-500 text-xl" />
              <span className="bg-red-500 text-white font-bold rounded-full px-2">B</span>
            </div>
          </div>
          {/* More camera icons */}
          {[...Array(18)].map((_, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                top: `${20 + (i * 2.5)}%`,
                left: `${30 + (i * 2)}%`,
              }}
            >
              <FaCamera className="text-blue-500 text-xl" />
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 bg-white rounded-lg shadow-md px-6 py-4 flex flex-col gap-2 text-sm">
          <span className="font-semibold">Legend</span>
          <div className="flex items-center gap-3">
            <FaCamera className="text-blue-500 text-lg" /> <span>Camera Coverage</span>
            <span className="bg-yellow-400 w-4 h-4 rounded-full inline-block border border-blue-500" /> <span>Active Camera</span>
          </div>
        </div>
        {/* Map controls */}
        <div className="absolute top-8 right-8 z-20 flex flex-col gap-2">
          <button className="bg-white rounded-full shadow p-2 text-xl font-bold">+</button>
          <button className="bg-white rounded-full shadow p-2 text-xl font-bold">-</button>
        </div>
      </main>
    </div>
  );
}
