import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, imageUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Upload, Image as ImageIcon, Clock, CheckCircle2, XCircle } from "lucide-react";

type Status = "not_started" | "pending" | "approved" | "rejected" | "loading";

type Submission = {
  id: string;
  id_type: string;
  full_name: string;
  status: Status;
  admin_note?: string | null;
  submitted_at?: string;
  reviewed_at?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved?: () => void;
};

export default function VerifyIdentityDialog({ open, onOpenChange, onApproved }: Props) {
  const { t } = useTranslation();
  const { user, refresh } = useAuth() as any;
  const idDocRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<Status>("loading");
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [form, setForm] = useState({
    id_type: "driver_license" as "driver_license" | "passport" | "national_id",
    id_number: "",
    full_name: user?.name || "",
  });
  const [idDocPath, setIdDocPath] = useState<string>("");
  const [idDocPreview, setIdDocPreview] = useState<string>("");
  const [selfiePath, setSelfiePath] = useState<string>("");
  const [selfiePreview, setSelfiePreview] = useState<string>("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus("loading");
    api.get("/identity/verify/status")
      .then((r) => {
        setStatus(r.data.status);
        setSubmission(r.data.submission || null);
      })
      .catch(() => setStatus("not_started"));
  }, [open]);

  const uploadImage = async (file: File, kind: "doc" | "selfie") => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("verify.image_only", "Please upload an image"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("verify.image_too_large", "Max 10 MB"));
      return;
    }
    const setter = kind === "doc" ? setUploadingDoc : setUploadingSelfie;
    setter(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (kind === "doc") {
        setIdDocPath(r.data.path);
        setIdDocPreview(imageUrl(r.data.path));
      } else {
        setSelfiePath(r.data.path);
        setSelfiePreview(imageUrl(r.data.path));
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t("verify.upload_failed", "Upload failed"));
    } finally {
      setter(false);
    }
  };

  const submit = async () => {
    if (!form.full_name.trim()) { toast.error(t("verify.need_name", "Please enter your full name")); return; }
    if (!form.id_number.trim()) { toast.error(t("verify.need_id_number", "Please enter the ID number")); return; }
    if (!idDocPath) { toast.error(t("verify.need_id_doc", "Please upload your ID document")); return; }
    if (!selfiePath) { toast.error(t("verify.need_selfie", "Please upload a selfie")); return; }
    setSubmitting(true);
    try {
      await api.post("/identity/verify/submit", {
        id_type: form.id_type,
        id_number: form.id_number.trim(),
        full_name: form.full_name.trim(),
        id_document_path: idDocPath,
        selfie_path: selfiePath,
      });
      setStatus("pending");
      toast.success(t("verify.submitted_toast", "Submitted! Our team will review within 1–2 business days."));
      if (refresh) await refresh();
      if (onApproved) onApproved();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t("verify.submit_failed", "Submission failed"));
    } finally {
      setSubmitting(false);
    }
  };

  // ------- Render states --------------------------------------------------
  const StatusBadge = () => {
    if (status === "pending") {
      return (
        <Badge data-testid="verify-status-pending" className="bg-amber-100 text-amber-800 border-0 gap-1.5 px-3 py-1">
          <Clock className="w-3.5 h-3.5" /> {t("verify.status_pending", "Under review")}
        </Badge>
      );
    }
    if (status === "approved") {
      return (
        <Badge data-testid="verify-status-approved" className="bg-green-100 text-green-800 border-0 gap-1.5 px-3 py-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> {t("verify.status_approved", "Verified")}
        </Badge>
      );
    }
    if (status === "rejected") {
      return (
        <Badge data-testid="verify-status-rejected" className="bg-red-100 text-red-800 border-0 gap-1.5 px-3 py-1">
          <XCircle className="w-3.5 h-3.5" /> {t("verify.status_rejected", "Not approved")}
        </Badge>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl" data-testid="verify-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-extrabold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-secondary" />
            {t("verify.title", "Verify your identity")}
          </DialogTitle>
          <DialogDescription>
            {t("verify.description", "Verified members get a badge on every listing and booking — and can be discovered through the 'Verified only' filter. Your ID is never shown publicly.")}
          </DialogDescription>
        </DialogHeader>

        {status === "loading" && (
          <div className="py-10 flex items-center justify-center text-brand-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t("common.loading", "Loading...")}
          </div>
        )}

        {/* Pending */}
        {status === "pending" && (
          <div className="py-2 space-y-3" data-testid="verify-pending-state">
            <StatusBadge />
            <p className="text-sm text-brand-muted">
              {t("verify.pending_body", "Your submission is in our review queue. We'll email you within 1–2 business days. You can keep using ToolShare while you wait.")}
            </p>
            {submission && (
              <div className="text-xs bg-brand-subtle rounded-xl p-3 space-y-1 border border-brand-border">
                <div><span className="text-brand-muted">{t("verify.submitted_name", "Name")}: </span>{submission.full_name}</div>
                <div><span className="text-brand-muted">{t("verify.id_type", "ID type")}: </span>{submission.id_type.replace("_", " ")}</div>
              </div>
            )}
          </div>
        )}

        {/* Rejected */}
        {status === "rejected" && (
          <div className="py-2 space-y-3" data-testid="verify-rejected-state">
            <StatusBadge />
            {submission?.admin_note && (
              <p className="text-sm bg-red-50 border border-red-200 rounded-xl p-3">
                <strong className="block mb-0.5 text-red-700">{t("verify.reviewer_note", "Reviewer note")}</strong>
                {submission.admin_note}
              </p>
            )}
            <Button
              onClick={() => { setStatus("not_started"); setSubmission(null); }}
              data-testid="verify-resubmit-btn"
              className="bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-xl font-semibold w-full"
            >
              {t("verify.resubmit", "Submit new documents")}
            </Button>
          </div>
        )}

        {/* Approved */}
        {status === "approved" && (
          <div className="py-2 space-y-3" data-testid="verify-approved-state">
            <StatusBadge />
            <p className="text-sm text-brand-muted">
              {t("verify.approved_body", "You're verified. The Verified badge now shows on all your listings and bookings.")}
            </p>
          </div>
        )}

        {/* Not started → form */}
        {status === "not_started" && (
          <div className="py-2 space-y-4" data-testid="verify-form">
            <div>
              <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold">
                {t("verify.id_type", "ID type")}
              </Label>
              <select
                value={form.id_type}
                onChange={(e) => setForm({ ...form, id_type: e.target.value as any })}
                data-testid="verify-id-type-select"
                className="w-full h-10 mt-1 rounded-xl border border-brand-border bg-white px-3 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="driver_license">{t("verify.id_driver_license", "Driver's license")}</option>
                <option value="passport">{t("verify.id_passport", "Passport")}</option>
                <option value="national_id">{t("verify.id_national", "National ID")}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold">
                  {t("verify.full_name", "Legal name")}
                </Label>
                <Input
                  data-testid="verify-name-input"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="rounded-xl mt-1"
                  placeholder={t("verify.name_placeholder", "As shown on your ID")}
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold">
                  {t("verify.id_number", "ID number")}
                </Label>
                <Input
                  data-testid="verify-id-number-input"
                  value={form.id_number}
                  onChange={(e) => setForm({ ...form, id_number: e.target.value })}
                  className="rounded-xl mt-1"
                  placeholder="A1234567"
                />
              </div>
            </div>

            <UploadTile
              label={t("verify.upload_id_doc", "Photo of your ID")}
              hint={t("verify.upload_id_hint", "Clear, no glare, all four corners visible")}
              preview={idDocPreview}
              uploading={uploadingDoc}
              inputRef={idDocRef}
              onChange={(f) => uploadImage(f, "doc")}
              testid="verify-upload-id"
            />
            <UploadTile
              label={t("verify.upload_selfie", "Selfie holding the ID")}
              hint={t("verify.upload_selfie_hint", "Make sure both your face and ID are readable")}
              preview={selfiePreview}
              uploading={uploadingSelfie}
              inputRef={selfieRef}
              onChange={(f) => uploadImage(f, "selfie")}
              testid="verify-upload-selfie"
            />

            <Button
              onClick={submit}
              disabled={submitting || uploadingDoc || uploadingSelfie}
              data-testid="verify-submit-btn"
              className="bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-xl font-semibold w-full h-11"
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              {t("verify.submit", "Submit for review")}
            </Button>
            <p className="text-xs text-brand-muted text-center">
              {t("verify.privacy_hint", "Your documents are stored privately and only seen by the ToolShare review team.")}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UploadTile({
  label, hint, preview, uploading, inputRef, onChange, testid,
}: {
  label: string;
  hint: string;
  preview: string;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (file: File) => void;
  testid: string;
}) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold">{label}</Label>
      <p className="text-[11px] text-brand-muted mt-0.5">{hint}</p>
      <div
        onClick={() => inputRef.current?.click()}
        data-testid={testid}
        className="mt-1.5 rounded-xl border-2 border-dashed border-brand-border hover:border-brand-primary/50 cursor-pointer transition-colors bg-brand-subtle/40 p-3 flex items-center gap-3"
      >
        <div className="w-16 h-16 rounded-lg bg-white border border-brand-border flex items-center justify-center overflow-hidden shrink-0">
          {preview
            ? <img src={preview} alt="preview" className="w-full h-full object-cover" />
            : <ImageIcon className="w-6 h-6 text-brand-muted" />}
        </div>
        <div className="flex-1 text-sm">
          {uploading
            ? <span className="text-brand-muted inline-flex items-center"><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Uploading…</span>
            : preview
              ? <span className="font-medium text-brand-text">Click to replace</span>
              : <span className="font-medium text-brand-text inline-flex items-center"><Upload className="w-4 h-4 mr-1.5" /> Click to upload</span>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); e.currentTarget.value = ""; }}
        />
      </div>
    </div>
  );
}
