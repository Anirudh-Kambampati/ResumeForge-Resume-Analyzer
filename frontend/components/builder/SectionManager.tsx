"use client";

import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock } from "lucide-react";
import { useResumeStore, type BuilderSection } from "@/store/resumeStore";
import { ALL_SECTIONS } from "@/config/sections";

// Sections that are fixed (non-draggable) at the top
const FIXED_SECTIONS = ["Profile"];
const FIXED_SET = new Set(FIXED_SECTIONS);

// Sections that can be reordered — excludes fixed sections
const MANAGED_SECTIONS = ALL_SECTIONS.filter((s) => !FIXED_SET.has(s.id));
const MANAGED_IDS = new Set(MANAGED_SECTIONS.map((s) => s.id));

// ============================================================
// Fixed (non-draggable) section row — Profile / About Me / Summary
// ============================================================

function FixedSection({
  label,
  onClick,
  isActive,
}: {
  label: string;
  onClick: () => void;
  isActive: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        group flex items-center gap-2 rounded-lg border px-2.5 py-[9px]
        transition-all duration-150 cursor-pointer
        ${
          isActive
            ? "border-blue-500/25 bg-blue-500/[0.06]"
            : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.03]"
        }
      `}
    >
      {/* Lock icon */}
      <div className="flex shrink-0 items-center justify-center text-zinc-600 group-hover:text-zinc-500 transition-colors duration-150">
        <Lock size={11} />
      </div>

      {/* Section label */}
      <span
        className={`flex-1 truncate text-[13px] leading-tight ${
          isActive ? "font-medium text-blue-300" : "font-medium text-zinc-300"
        }`}
      >
        {label}
      </span>

      {/* "Fixed" badge */}
      <span className="text-[8px] font-normal uppercase tracking-[0.15em] text-zinc-600">
        Fixed
      </span>
    </div>
  );
}

// ============================================================
// Sortable section row — draggable sections
// ============================================================

function SortableSection({
  id,
  label,
  onClick,
  isActive,
}: {
  id: string;
  label: string;
  onClick: (id: string) => void;
  isActive: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : ("auto" as any),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group flex items-center gap-2 rounded-lg border px-2.5 py-[9px]
        transition-all duration-150 cursor-pointer
        ${
          isDragging
            ? "border-blue-500/30 bg-blue-500/8 shadow-xl shadow-blue-500/10 scale-[1.02]"
            : isActive
              ? "border-blue-500/25 bg-blue-500/[0.06]"
              : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.03]"
        }
      `}
      onClick={() => onClick(id)}
    >
      {/* Drag handle — subtle, secondary */}
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="flex shrink-0 cursor-grab touch-none items-center justify-center text-zinc-600 transition-colors duration-150 hover:text-zinc-400 active:cursor-grabbing group-hover:text-zinc-500"
        aria-label={`Drag ${label}`}
      >
        <GripVertical size={12} />
      </button>

      {/* Section label */}
      <span
        className={`flex-1 truncate text-[13px] leading-tight transition-colors duration-150 ${
          isActive ? "font-medium text-zinc-100" : "font-medium text-zinc-300"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// ============================================================
// Section divider label
// ============================================================

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
        {label}
      </span>
      <div className="flex-1 border-t border-zinc-800" />
    </div>
  );
}

// ============================================================
// Main Section Manager
// ============================================================

type Props = {
  selectedSection: BuilderSection;
  setSelectedSection: (section: BuilderSection) => void;
};

export default function SectionManager({
  selectedSection,
  setSelectedSection,
}: Props) {
  const resume = useResumeStore((s) => s.resume);
  const setSectionOrder = useResumeStore((s) => s.setSectionOrder);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Build ordered list of draggable section IDs from sectionOrder
  const sectionIds = useMemo(
    () =>
      (resume.sectionOrder || []).filter((id) => MANAGED_IDS.has(id)),
    [resume.sectionOrder]
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sectionIds.indexOf(active.id as string);
    const newIndex = sectionIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sectionIds, oldIndex, newIndex);

    // Merge: non-managed + fixed (Profile) + reordered
    const nonManaged = (resume.sectionOrder || []).filter(
      (id) => !MANAGED_IDS.has(id) && !FIXED_SET.has(id)
    );
    const fixed = (resume.sectionOrder || []).filter((id) =>
      FIXED_SET.has(id)
    );
    setSectionOrder([...nonManaged, ...fixed, ...reordered]);
  }

  function handleSectionClick(id: string) {
    setSelectedSection(id as BuilderSection);
  }

  const sectionInfoMap = useMemo(
    () => new Map(ALL_SECTIONS.map((s) => [s.id, s.label])),
    []
  );

  return (
    <div>
      {/* Fixed sections — always at top */}
      {FIXED_SECTIONS.map((id, idx) => {
        const label = sectionInfoMap.get(id);
        if (!label) return null;
        return (
          <FixedSection
            key={id}
            label={label}
            onClick={() => handleSectionClick(id)}
            isActive={selectedSection === id}
          />
        );
      })}

      {/* Divider before draggable sections */}
      {sectionIds.length > 0 && FIXED_SECTIONS.length > 0 && <SectionDivider label="Reorderable" />}


      {/* Draggable sections */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sectionIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-0.5">
            {sectionIds.map((id) => {
              const label = sectionInfoMap.get(id);
              if (!label) return null;
              return (
                <SortableSection
                  key={id}
                  id={id}
                  label={label}
                  onClick={handleSectionClick}
                  isActive={selectedSection === id}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
