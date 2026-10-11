import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, GitBranch, Maximize, RotateCcw, Sparkles, ZoomIn, ZoomOut } from "lucide-react";
import { layoutCurriculum, NODE_HEIGHT, NODE_WIDTH } from "../utils/curriculumLayout.js";
import "./CurriculumTree.css";

const clampZoom = (zoom) => Math.min(2, Math.max(0.15, zoom));

export default function CurriculumTree({ curriculum }) {
  const navigate = useNavigate();
  const graph = curriculum.graph;
  const layout = useMemo(() => layoutCurriculum(graph.nodes, graph.edges, graph.rootId), [graph]);
  const [positions, setPositions] = useState(layout.positions);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [wiggle, setWiggle] = useState(true);
  const [dragging, setDragging] = useState(false);
  const viewport = useRef(null);
  const gesture = useRef(null);
  const suppressClick = useRef(false);

  const fit = useCallback((nextPositions = positions) => {
    const element = viewport.current;
    if (!element) return;
    const points = Object.values(nextPositions);
    const minX = Math.min(...points.map((p) => p.x)) - 40;
    const minY = Math.min(...points.map((p) => p.y)) - 40;
    const width = Math.max(...points.map((p) => p.x)) + NODE_WIDTH + 40 - minX;
    const height = Math.max(...points.map((p) => p.y)) + NODE_HEIGHT + 40 - minY;
    const zoom = clampZoom(Math.min(element.clientWidth / width, element.clientHeight / height, 1));
    setView({ x: (element.clientWidth - width * zoom) / 2 - minX * zoom,
      y: (element.clientHeight - height * zoom) / 2 - minY * zoom, zoom });
  }, [positions]);

  // Fit initially and when the viewport changes size, while retaining manual panning.
  const fitRef = useRef(fit);
  useEffect(() => { fitRef.current = fit; }, [fit]);
  useEffect(() => {
    const observer = new ResizeObserver(() => fitRef.current());
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  const zoomBy = (factor) => {
    const element = viewport.current;
    setView((current) => {
      const zoom = clampZoom(current.zoom * factor);
      const ratio = zoom / current.zoom;
      return { zoom,
        x: element.clientWidth / 2 - (element.clientWidth / 2 - current.x) * ratio,
        y: element.clientHeight / 2 - (element.clientHeight / 2 - current.y) * ratio };
    });
  };

  const startDrag = (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    const nodeId = event.target.closest("[data-node-id]")?.dataset.nodeId;
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      nodeId, origin: nodeId ? positions[nodeId] : view, zoom: view.zoom, moved: false };
  };

  const moveDrag = (event) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < 6) return;
    current.moved = true;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    suppressClick.current = true;
    setDragging(true);
    if (current.nodeId) {
      setPositions((previous) => ({ ...previous, [current.nodeId]: {
        x: current.origin.x + dx / current.zoom, y: current.origin.y + dy / current.zoom,
      } }));
    } else {
      setView({ ...current.origin, x: current.origin.x + dx, y: current.origin.y + dy });
    }
  };

  const endDrag = (event) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const controls = "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-600";

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <GitBranch size={17} className="text-indigo-600" />
          <span>{curriculum.nodes.length} lessons · {Math.round(view.zoom * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={controls} onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out" title="Zoom out"><ZoomOut size={18} /></button>
          <button type="button" className={controls} onClick={() => zoomBy(1.2)} aria-label="Zoom in" title="Zoom in"><ZoomIn size={18} /></button>
          <button type="button" className={controls} onClick={() => fit()} aria-label="Fit tree to view" title="Fit tree"><Maximize size={18} /></button>
          <button type="button" className={controls} onClick={() => { setPositions(layout.positions); fit(layout.positions); }} aria-label="Reset tree layout" title="Reset layout"><RotateCcw size={18} /></button>
          <button type="button" className={`${controls} ${wiggle ? "!border-indigo-200 !bg-indigo-50 !text-indigo-600" : ""}`} aria-pressed={wiggle} onClick={() => setWiggle((value) => !value)} aria-label="Toggle gentle wiggle" title="Toggle wiggle"><Sparkles size={18} /></button>
        </div>
      </div>
      <div ref={viewport} className={`curriculum-viewport ${dragging ? "is-dragging" : ""}`}
        tabIndex={0} aria-label="Curriculum tree. Drag the background to pan, or drag a node to move it. Use arrow keys to pan and plus or minus to zoom."
        onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
        onLostPointerCapture={() => { gesture.current = null; setDragging(false); }}
        onClickCapture={(event) => {
          if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); }
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const directions = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] };
          if (directions[event.key]) {
            event.preventDefault();
            const [x, y] = directions[event.key];
            setView((current) => ({ ...current, x: current.x + x, y: current.y + y }));
          } else if (event.key === "+" || event.key === "=" || event.key === "-") {
            event.preventDefault(); zoomBy(event.key === "-" ? 1 / 1.2 : 1.2);
          }
        }}>
        <div className="curriculum-stage" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
          <svg className="curriculum-connections" aria-hidden="true">
            {graph.edges.map((edge) => {
              const from = positions[edge.source];
              const to = positions[edge.target];
              if (!from || !to) return null;
              const x1 = from.x + NODE_WIDTH / 2;
              const y1 = from.y + NODE_HEIGHT;
              const x2 = to.x + NODE_WIDTH / 2;
              const y2 = to.y;
              return <path key={edge.target} d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`} fill="none" stroke="#c4b5fd" strokeWidth="2.5" />;
            })}
          </svg>
          {graph.nodes.map((node, index) => {
            const position = positions[node.id];
            if (!position) return null;
            const root = node.id === graph.rootId;
            const available = Boolean(node.lesson?._id);
            return (
              <div key={node.id} data-node-id={node.id} className="curriculum-node" style={{ left: position.x, top: position.y }}>
                <button type="button" className={`curriculum-node-card ${root ? "is-root" : ""} ${wiggle && !dragging ? "has-wiggle" : ""}`}
                  style={{ animationDelay: `${index * -0.7}s` }} aria-disabled={!root && !available}
                  aria-label={root ? `${node.label}, curriculum root` : available ? `Open lesson: ${node.label}` : "Unavailable lesson"}
                  onClick={() => { if (available) navigate(`/lessons/${node.lesson._id}`, { state: { lesson: node.lesson } }); }}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${root ? "bg-white/15 text-amber-200" : "bg-indigo-50 text-indigo-600"}`}>
                    {root ? <GitBranch size={20} /> : <BookOpen size={20} />}
                  </span>
                  <span className="min-w-0 text-left">
                    <span className={`block text-[10px] font-semibold uppercase tracking-[0.16em] ${root ? "text-indigo-200" : "text-gray-400"}`}>{root ? "Curriculum" : available ? `Lesson${node.lesson.year ? ` · Year ${node.lesson.year}` : ""}` : "Lesson removed"}</span>
                    <span className="mt-1 line-clamp-2 block break-words text-sm font-semibold leading-5" dir="auto">{node.label}</span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <p className="border-t border-gray-100 px-4 py-3 text-xs leading-5 text-gray-500 sm:px-6">Drag to explore. Move a node to rearrange the view. Click a lesson to open it. Layout changes stay in this view.</p>
    </div>
  );
}
