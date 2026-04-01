import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { formatDateTime, truncate } from "../../lib/format";

const emptyFilters = {
  q: "",
  intent: "",
  grounded: "",
  limit: 30,
};

function formatTraceValue(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      return "-";
    }
    if (value.every((item) => typeof item !== "object" || item === null)) {
      return value.join(" / ");
    }
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function TraceValue({ value }) {
  const rendered = formatTraceValue(value);
  const multiline = typeof rendered === "string" && (rendered.includes("\n") || rendered.length > 120);
  if (multiline) {
    return <pre className="trace-pre">{rendered}</pre>;
  }
  return <strong>{rendered}</strong>;
}

function groundedBadge(grounded) {
  return grounded ? "indexed" : "pending";
}

export function TracePage() {
  const { fetchAgentTask, fetchAgentTasks, setGlobalNotice } = useAppContext();
  const [filters, setFilters] = useState(emptyFilters);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      setLoading(true);
      try {
        const data = await fetchAgentTasks({
          q: filters.q,
          intent: filters.intent,
          grounded: filters.grounded === "" ? null : filters.grounded,
          limit: filters.limit,
        });
        if (cancelled) {
          return;
        }
        setRows(data);
        setSelectedTaskId((current) => {
          if (current && data.some((item) => item.id === current)) {
            return current;
          }
          return data[0]?.id || "";
        });
      } catch (error) {
        if (!cancelled) {
          setGlobalNotice(error.message || "任务观测列表加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTasks();
    return () => {
      cancelled = true;
    };
  }, [fetchAgentTasks, filters, setGlobalNotice]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedTaskId) {
      setDetail(null);
      return () => {
        cancelled = true;
      };
    }

    async function loadDetail() {
      setDetailLoading(true);
      try {
        const data = await fetchAgentTask(selectedTaskId);
        if (!cancelled) {
          setDetail(data);
        }
      } catch (error) {
        if (!cancelled) {
          setGlobalNotice(error.message || "任务详情加载失败");
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [fetchAgentTask, selectedTaskId, setGlobalNotice]);

  const selectedSummary = detail?.summary || null;
  const traceItems = detail?.task?.trace || [];
