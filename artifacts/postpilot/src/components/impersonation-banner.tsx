import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getImpersonatedUserId,
  getImpersonatedEmail,
  stopImpersonation,
  subscribeImpersonation,
} from "@/lib/impersonation";
import { Eye, X } from "lucide-react";

export default function ImpersonationBanner() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setUserId(getImpersonatedUserId());
    setEmail(getImpersonatedEmail());
    const unsub = subscribeImpersonation((id) => {
      setUserId(id);
      setEmail(getImpersonatedEmail());
    });
    return unsub;
  }, []);

  if (!userId) return null;

  const handleStop = () => {
    stopImpersonation();
    queryClient.invalidateQueries();
  };

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium flex items-center justify-center gap-3 sticky top-0 z-50">
      <Eye className="w-4 h-4" />
      <span>
        Viewing as <span className="font-bold">{email ?? `user #${userId}`}</span> · all
        actions are logged
      </span>
      <button
        onClick={handleStop}
        className="ml-2 inline-flex items-center gap-1 bg-amber-950/10 hover:bg-amber-950/20 px-2 py-0.5 rounded text-xs"
      >
        <X className="w-3 h-3" />
        Stop impersonating
      </button>
    </div>
  );
}
