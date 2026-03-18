import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Trash2, Pencil, Plus, X } from "lucide-react";
import { CATEGORIES } from "@/lib/program-categories";

// ── Types ──────────────────────────────────────────────
interface Program {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  category: string;
  emoji: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

interface Company { id: string; name: string; }

interface Campaign {
  id: string;
  title: string;
  emoji: string | null;
  starts_at: string;
  ends_at: string;
  bonus_points: number | null;
  active: boolean | null;
  program_id: string | null;
  company_id: string;
}

interface CampaignMission {
  campaign_mission_id: string;
  mission_id: string;
  title: string;
  emoji: string | null;
  points: number | null;
  frequency: string | null;
  tag: string;
  validation_type: string | null;
  questionnaire_id: string | null;
}

interface QuestionDraft {
  category: string;
  question_text: string;
}

interface ExistingQuestionnaire {
  id: string;
  title: string;
}

// ── Frequency helpers ──────────────────────────────────
const FREQ_LABELS: Record<string, string> = { daily: "Diária", weekly: "Semanal", monthly: "Mensal", once: "Única" };
const FREQ_OPTIONS = [
  { value: "daily", label: "Diária" },
  { value: "weekly", label: "Semanal" },
  { value: "once", label: "Única" },
];

const TAG_OPTIONS = [
  { value: "movimento", label: "Movimento" },
  { value: "sono", label: "Sono" },
  { value: "hidratacao", label: "Hidratação" },
  { value: "mindfulness", label: "Mindfulness" },
  { value: "nutricao", label: "Nutrição" },
  { value: "saude_mental", label: "Saúde Mental" },
  { value: "geral", label: "Geral" },
];

const VALIDATION_OPTIONS = [
  { value: "self_report", label: "Auto-relato", badge: "✅ Auto-relato" },
  { value: "photo_proof", label: "Foto comprovante", badge: "📷 Foto" },
  { value: "auto_survey", label: "Automática: Questionário", badge: "📋 Questionário" },
  { value: "auto_checkin", label: "Automática: Check-in", badge: "🤖 Check-in" },
];

const VALIDATION_BADGE: Record<string, string> = Object.fromEntries(VALIDATION_OPTIONS.map(o => [o.value, o.badge]));

// ── Component ──────────────────────────────────────────
interface AdminProgramsProps {
  companyId?: string;
}

export function AdminPrograms({ companyId }: AdminProgramsProps = {}) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // Expand state
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());

  // Campaigns & missions loaded per program / campaign
  const [campaignsByProgram, setCampaignsByProgram] = useState<Record<string, Campaign[]>>({});
  const [missionsByCampaign, setMissionsByCampaign] = useState<Record<string, CampaignMission[]>>({});

  // Counters
  const [campaignCounts, setCampaignCounts] = useState<Record<string, number>>({});
  const [missionCounts, setMissionCounts] = useState<Record<string, number>>({});

  // Modals
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [programForm, setProgramForm] = useState({ title: "", description: "", category: "general", emoji: "🌿", company_id: "", starts_at: "", ends_at: "" });

  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campaignParent, setCampaignParent] = useState<Program | null>(null);
  const [campaignForm, setCampaignForm] = useState({ title: "", emoji: "🏆", starts_at: "", ends_at: "", bonus_points: "0" });

  const [showMissionForm, setShowMissionForm] = useState(false);
  const [missionParentCampaign, setMissionParentCampaign] = useState<Campaign | null>(null);
  const [missionParentProgram, setMissionParentProgram] = useState<Program | null>(null);
  const [editingMission, setEditingMission] = useState<CampaignMission | null>(null);
  const [missionForm, setMissionForm] = useState({ title: "", points: "10", frequency: "daily", tag: "geral", validation_type: "self_report" });

  // Questionnaire state
  const [surveyMode, setSurveyMode] = useState<"new" | "existing">("new");
  const [surveyQuestionnaireId, setSurveyQuestionnaireId] = useState("");
  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyQuestions, setSurveyQuestions] = useState<QuestionDraft[]>([{ category: "Geral", question_text: "" }]);
  const [existingQuestionnaires, setExistingQuestionnaires] = useState<ExistingQuestionnaire[]>([]);
  const [loadedSurveyQuestions, setLoadedSurveyQuestions] = useState<QuestionDraft[]>([]);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ type: "program" | "campaign" | "mission"; id: string; title: string; campaignId?: string } | null>(null);

  // ── Load ──────────────────────────────────────────────
  const load = useCallback(async () => {
    let pQuery = supabase.from("wellbeing_programs").select("id, company_id, title, description, category, emoji, active, starts_at, ends_at").order("created_at", { ascending: false });
    if (companyId) pQuery = pQuery.eq("company_id", companyId);
    const [p, c] = await Promise.all([
      pQuery,
      supabase.from("companies").select("id, name").order("name"),
    ]);
    const progs = (p.data || []) as Program[];
    setPrograms(progs);
    setCompanies((c.data as Company[]) || []);

    // Load counts for all programs
    if (progs.length > 0) {
      const progIds = progs.map(pr => pr.id);
      const { data: camps } = await supabase.from("campaigns").select("id, program_id").in("program_id", progIds);
      const counts: Record<string, number> = {};
      progIds.forEach(id => { counts[id] = 0; });
      (camps || []).forEach((c: any) => { if (c.program_id) counts[c.program_id] = (counts[c.program_id] || 0) + 1; });
      setCampaignCounts(counts);

      // Mission counts per program (via campaign_missions)
      const campIds = (camps || []).map((c: any) => c.id);
      if (campIds.length > 0) {
        const { data: cms } = await supabase.from("campaign_missions").select("id, campaign_id").in("campaign_id", campIds);
        const mCounts: Record<string, number> = {};
        const campToProgram: Record<string, string> = {};
        (camps || []).forEach((c: any) => { if (c.program_id) campToProgram[c.id] = c.program_id; });
        progIds.forEach(id => { mCounts[id] = 0; });
        (cms || []).forEach((cm: any) => {
          const progId = campToProgram[cm.campaign_id];
          if (progId) mCounts[progId] = (mCounts[progId] || 0) + 1;
        });
        setMissionCounts(mCounts);
      }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadCampaigns = async (programId: string) => {
    const { data } = await supabase.from("campaigns").select("id, title, emoji, starts_at, ends_at, bonus_points, active, program_id, company_id").eq("program_id", programId).order("created_at", { ascending: false });
    setCampaignsByProgram(prev => ({ ...prev, [programId]: (data || []) as Campaign[] }));
  };

  const loadMissions = async (campaignId: string) => {
    const { data } = await supabase.from("campaign_missions").select("id, mission_id, sort_order").eq("campaign_id", campaignId).order("sort_order");
    if (!data || data.length === 0) {
      setMissionsByCampaign(prev => ({ ...prev, [campaignId]: [] }));
      return;
    }
    const missionIds = data.map((d: any) => d.mission_id);
    const { data: missions } = await supabase.from("missions").select("id, title, emoji, points, frequency, tag, validation_type, questionnaire_id").in("id", missionIds);
    const missionsMap = new Map((missions || []).map((m: any) => [m.id, m]));
    const result: CampaignMission[] = data.map((d: any) => {
      const m = missionsMap.get(d.mission_id);
      return m ? { campaign_mission_id: d.id, mission_id: m.id, title: m.title, emoji: m.emoji, points: m.points, frequency: m.frequency, tag: m.tag, validation_type: m.validation_type, questionnaire_id: m.questionnaire_id } : null;
    }).filter(Boolean) as CampaignMission[];
    setMissionsByCampaign(prev => ({ ...prev, [campaignId]: result }));
  };

  // ── Toggle expand ─────────────────────────────────────
  const toggleProgram = (id: string) => {
    setExpandedPrograms(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); loadCampaigns(id); }
      return next;
    });
  };

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); loadMissions(id); }
      return next;
    });
  };

  // ── Program CRUD ──────────────────────────────────────
  const openNewProgram = () => {
    setEditingProgram(null);
    setProgramForm({ title: "", description: "", category: "general", emoji: "🌿", company_id: companyId || companies[0]?.id || "", starts_at: "", ends_at: "" });
    setShowProgramForm(true);
  };

  const openEditProgram = (p: Program) => {
    setEditingProgram(p);
    setProgramForm({ title: p.title, description: p.description || "", category: p.category, emoji: p.emoji, company_id: p.company_id, starts_at: p.starts_at || "", ends_at: p.ends_at || "" });
    setShowProgramForm(true);
  };

  const saveProgram = async () => {
    if (!programForm.title || !programForm.company_id) { toast.error("Preencha título e empresa."); return; }
    const payload = {
      title: programForm.title, description: programForm.description || null, category: programForm.category,
      emoji: programForm.emoji, company_id: programForm.company_id,
      starts_at: programForm.starts_at || null, ends_at: programForm.ends_at || null,
    };
    if (editingProgram) {
      const { error } = await supabase.from("wellbeing_programs").update(payload).eq("id", editingProgram.id);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Programa atualizado.");
    } else {
      const { error } = await supabase.from("wellbeing_programs").insert(payload);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Programa criado.");
    }
    setShowProgramForm(false);
    load();
  };

  const toggleProgramActive = async (p: Program, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("wellbeing_programs").update({ active: !p.active }).eq("id", p.id);
    load();
  };

  // ── Campaign CRUD ─────────────────────────────────────
  const openNewCampaign = (program: Program) => {
    setCampaignParent(program);
    setEditingCampaign(null);
    setCampaignForm({ title: "", emoji: "🏆", starts_at: "", ends_at: "", bonus_points: "0" });
    setShowCampaignForm(true);
  };

  const openEditCampaign = (campaign: Campaign, program: Program) => {
    setCampaignParent(program);
    setEditingCampaign(campaign);
    setCampaignForm({ title: campaign.title, emoji: campaign.emoji || "🏆", starts_at: campaign.starts_at, ends_at: campaign.ends_at, bonus_points: String(campaign.bonus_points || 0) });
    setShowCampaignForm(true);
  };

  const saveCampaign = async () => {
    if (!campaignForm.title || !campaignForm.starts_at || !campaignForm.ends_at || !campaignParent) { toast.error("Preencha todos os campos."); return; }
    const payload = {
      title: campaignForm.title, emoji: campaignForm.emoji, starts_at: campaignForm.starts_at, ends_at: campaignForm.ends_at,
      bonus_points: parseInt(campaignForm.bonus_points) || 0, program_id: campaignParent.id, company_id: campaignParent.company_id,
    };
    if (editingCampaign) {
      const { error } = await supabase.from("campaigns").update(payload).eq("id", editingCampaign.id);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Campanha atualizada.");
    } else {
      const { error } = await supabase.from("campaigns").insert(payload);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Campanha criada.");
    }
    setShowCampaignForm(false);
    loadCampaigns(campaignParent.id);
    load();
  };

  // ── Mission CRUD ──────────────────────────────────────
  const loadExistingQuestionnaires = async () => {
    const { data } = await supabase.from("questionnaires").select("id, title");
    setExistingQuestionnaires((data || []) as ExistingQuestionnaire[]);
  };

  const loadSurveyQuestions = async (qId: string) => {
    const { data } = await supabase.from("questionnaire_questions").select("category, question_text").eq("questionnaire_id", qId).order("sort_order");
    setLoadedSurveyQuestions((data || []) as QuestionDraft[]);
  };

  const resetSurveyState = () => {
    setSurveyMode("new");
    setSurveyQuestionnaireId("");
    setSurveyTitle("");
    setSurveyQuestions([{ category: "Geral", question_text: "" }]);
    setLoadedSurveyQuestions([]);
  };

  const openNewMission = (campaign: Campaign, program: Program) => {
    setMissionParentCampaign(campaign);
    setMissionParentProgram(program);
    setEditingMission(null);
    setMissionForm({ title: "", points: "10", frequency: "daily", tag: "geral", validation_type: "self_report" });
    resetSurveyState();
    loadExistingQuestionnaires();
    setShowMissionForm(true);
  };

  const openEditMission = (m: CampaignMission, campaign: Campaign, program: Program) => {
    setMissionParentCampaign(campaign);
    setMissionParentProgram(program);
    setEditingMission(m);
    setMissionForm({ title: m.title, points: String(m.points || 0), frequency: m.frequency || "daily", tag: m.tag, validation_type: m.validation_type || "self_report" });
    resetSurveyState();
    loadExistingQuestionnaires();
    if (m.questionnaire_id) {
      setSurveyMode("existing");
      setSurveyQuestionnaireId(m.questionnaire_id);
      loadSurveyQuestions(m.questionnaire_id);
    }
    setShowMissionForm(true);
  };

  const createQuestionnaireIfNeeded = async (): Promise<string | null> => {
    if (missionForm.validation_type !== "auto_survey") return null;
    if (surveyMode === "existing") return surveyQuestionnaireId || null;
    // Create new questionnaire
    if (!surveyTitle.trim()) { toast.error("Preencha o título do questionário."); return undefined as any; }
    const validQs = surveyQuestions.filter(q => q.question_text.trim());
    if (validQs.length === 0) { toast.error("Adicione pelo menos uma pergunta."); return undefined as any; }
    const { data: q, error } = await supabase.from("questionnaires").insert({ title: surveyTitle.trim() }).select("id").single();
    if (error || !q) { toast.error("Erro ao criar questionário: " + (error?.message || "")); return undefined as any; }
    const questionsToInsert = validQs.map((qq, i) => ({
      questionnaire_id: q.id, category: qq.category || "Geral", question_text: qq.question_text, sort_order: i,
    }));
    const { error: qErr } = await supabase.from("questionnaire_questions").insert(questionsToInsert);
    if (qErr) { toast.error("Erro ao salvar perguntas."); return undefined as any; }
    return q.id;
  };

  const saveMission = async () => {
    if (!missionForm.title || !missionParentCampaign) { toast.error("Preencha o nome da missão."); return; }

    // Handle questionnaire
    let questionnaireId: string | null = null;
    if (missionForm.validation_type === "auto_survey") {
      const result = await createQuestionnaireIfNeeded();
      if (result === undefined) return; // error occurred
      questionnaireId = result;
    }

    const payload: any = {
      title: missionForm.title, points: parseInt(missionForm.points) || 0, frequency: missionForm.frequency,
      tag: missionForm.tag, validation_type: missionForm.validation_type,
      questionnaire_id: questionnaireId,
    };
    if (editingMission) {
      const { error } = await supabase.from("missions").update(payload).eq("id", editingMission.mission_id);
      if (error) { toast.error("Erro ao atualizar missão: " + error.message); return; }
      toast.success("Missão atualizada.");
    } else {
      const { data: mission, error } = await supabase.from("missions").insert({
        ...payload, emoji: "🎯", active: true,
      }).select("id").single();
      if (error || !mission) { toast.error("Erro ao criar missão: " + (error?.message || "")); return; }
      const { error: linkError } = await supabase.from("campaign_missions").insert({
        campaign_id: missionParentCampaign.id, mission_id: mission.id, sort_order: 0,
      });
      if (linkError) { toast.error("Erro ao vincular missão."); return; }
    }
    setShowMissionForm(false);
    loadMissions(missionParentCampaign.id);
    load();
  };

  // ── Delete ────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    let error;
    if (deleteTarget.type === "program") {
      ({ error } = await supabase.from("wellbeing_programs").delete().eq("id", deleteTarget.id));
    } else if (deleteTarget.type === "campaign") {
      ({ error } = await supabase.from("campaigns").delete().eq("id", deleteTarget.id));
    } else {
      // Unlink mission from campaign
      ({ error } = await supabase.from("campaign_missions").delete().eq("id", deleteTarget.id));
    }
    if (error) { toast.error("Erro: " + error.message); } else { toast.success(deleteTarget.type === "mission" ? "Missão desvinculada." : "Excluído com sucesso."); }
    setDeleteTarget(null);
    load();
    // Reload relevant data
    if (deleteTarget.type === "campaign") {
      const prog = programs.find(p => expandedPrograms.has(p.id) && campaignsByProgram[p.id]?.some(c => c.id === deleteTarget.id));
      if (prog) loadCampaigns(prog.id);
    }
    if (deleteTarget.type === "mission" && deleteTarget.campaignId) {
      loadMissions(deleteTarget.campaignId);
    }
  };

  const companyName = (id: string) => companies.find(c => c.id === id)?.name || "—";

  // ── Render ────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">🌿 Programas de Bem-estar</h2>
        <Button onClick={openNewProgram}><Plus className="h-4 w-4 mr-1" /> Novo Programa</Button>
      </div>

      {programs.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum programa cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {programs.map(prog => {
            const isOpen = expandedPrograms.has(prog.id);
            const camps = campaignsByProgram[prog.id] || [];
            const cCount = campaignCounts[prog.id] || 0;
            const mCount = missionCounts[prog.id] || 0;

            return (
              <Collapsible key={prog.id} open={isOpen} onOpenChange={() => toggleProgram(prog.id)}>
                <Card className="border">
                  <CollapsibleTrigger asChild>
                    <CardContent className="p-4 flex items-center gap-3 cursor-pointer hover:bg-secondary/50 transition">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="text-2xl">{prog.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">{prog.title}</p>
                        <p className="text-xs text-muted-foreground">{cCount} campanha{cCount !== 1 ? "s" : ""} · {mCount} miss{mCount !== 1 ? "ões" : "ão"} · {companyName(prog.company_id)}</p>
                      </div>
                      <Badge variant={prog.active ? "default" : "secondary"}>{prog.active ? "Ativo" : "Inativo"}</Badge>
                      <Badge variant="outline">{CATEGORIES.find(c => c.value === prog.category)?.label || prog.category}</Badge>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleProgramActive(prog, e); }}>
                        {prog.active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEditProgram(prog); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "program", id: prog.id, title: prog.title }); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-4 pb-4 pl-12 space-y-2">
                      {camps.length === 0 && <p className="text-sm text-muted-foreground py-2">Nenhuma campanha neste programa.</p>}

                      {camps.map(camp => {
                        const campOpen = expandedCampaigns.has(camp.id);
                        const missions = missionsByCampaign[camp.id] || [];

                        return (
                          <Collapsible key={camp.id} open={campOpen} onOpenChange={() => toggleCampaign(camp.id)}>
                            <div className="border rounded-lg bg-card">
                              <CollapsibleTrigger asChild>
                                <div className="p-3 flex items-center gap-2 cursor-pointer hover:bg-secondary/30 transition rounded-lg">
                                  {campOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                  <span className="text-lg">{camp.emoji || "🏆"}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-foreground">{camp.title}</p>
                                    <p className="text-[11px] text-muted-foreground">{camp.starts_at} → {camp.ends_at} · {camp.bonus_points || 0} pts bônus</p>
                                  </div>
                                  <Badge variant={camp.active ? "default" : "secondary"} className="text-[10px]">{camp.active ? "Ativa" : "Inativa"}</Badge>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditCampaign(camp, prog); }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "campaign", id: camp.id, title: camp.title }); }}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                <div className="px-3 pb-3 pl-10 space-y-1">
                                  {missions.length === 0 && <p className="text-xs text-muted-foreground py-1">Nenhuma missão nesta campanha.</p>}
                                  {missions.map(m => (
                                    <div key={m.campaign_mission_id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-secondary/30 transition">
                                      <span className="text-sm">{m.emoji || "🎯"}</span>
                                      <span className="flex-1 text-sm text-foreground">{m.title}</span>
                                      <Badge variant="outline" className="text-[10px]">{m.points || 0} pts</Badge>
                                      <Badge variant="outline" className="text-[10px]">{FREQ_LABELS[m.frequency || ""] || m.frequency}</Badge>
                                      <Badge variant="secondary" className="text-[10px]">{VALIDATION_BADGE[m.validation_type || "self_report"] || "✅"}</Badge>
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditMission(m, camp, prog)}>
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteTarget({ type: "mission", id: m.campaign_mission_id, title: m.title, campaignId: missionParentCampaign?.id || camp.id })}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                  <button
                                    className="text-xs text-primary hover:underline mt-1 flex items-center gap-1 bg-transparent border-none cursor-pointer"
                                    onClick={() => openNewMission(camp, prog)}
                                  >
                                    <Plus className="h-3 w-3" /> Adicionar missão
                                  </button>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}

                      <button
                        className="text-xs text-primary hover:underline mt-1 flex items-center gap-1 bg-transparent border-none cursor-pointer"
                        onClick={() => openNewCampaign(prog)}
                      >
                        <Plus className="h-3 w-3" /> Adicionar campanha
                      </button>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* ── Modal: Program ─────────────────────────────── */}
      <Dialog open={showProgramForm} onOpenChange={setShowProgramForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingProgram ? "Editar Programa" : "Novo Programa"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div className="space-y-1"><Label>Emoji</Label><Input value={programForm.emoji} onChange={e => setProgramForm(f => ({ ...f, emoji: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Título</Label><Input value={programForm.title} onChange={e => setProgramForm(f => ({ ...f, title: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Descrição</Label><Textarea value={programForm.description} onChange={e => setProgramForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Empresa</Label>
                <Select value={programForm.company_id} onValueChange={v => setProgramForm(f => ({ ...f, company_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={programForm.category} onValueChange={v => setProgramForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Início</Label><Input type="date" value={programForm.starts_at} onChange={e => setProgramForm(f => ({ ...f, starts_at: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Fim</Label><Input type="date" value={programForm.ends_at} onChange={e => setProgramForm(f => ({ ...f, ends_at: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProgramForm(false)}>Cancelar</Button>
            <Button onClick={saveProgram}>{editingProgram ? "Salvar" : "Criar Programa"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Campaign ────────────────────────────── */}
      <Dialog open={showCampaignForm} onOpenChange={setShowCampaignForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingCampaign ? "Editar Campanha" : "Nova Campanha"}</DialogTitle></DialogHeader>
          {campaignParent && (
            <div className="bg-secondary/50 rounded-md px-3 py-2 text-xs text-muted-foreground">
              Dentro de › <span className="font-medium text-foreground">{campaignParent.emoji} {campaignParent.title}</span>
            </div>
          )}
          <div className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div className="space-y-1"><Label>Emoji</Label><Input value={campaignForm.emoji} onChange={e => setCampaignForm(f => ({ ...f, emoji: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Nome da campanha</Label><Input value={campaignForm.title} onChange={e => setCampaignForm(f => ({ ...f, title: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Data início</Label><Input type="date" value={campaignForm.starts_at} onChange={e => setCampaignForm(f => ({ ...f, starts_at: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Data fim</Label><Input type="date" value={campaignForm.ends_at} onChange={e => setCampaignForm(f => ({ ...f, ends_at: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Pontos de bônus</Label><Input type="number" value={campaignForm.bonus_points} onChange={e => setCampaignForm(f => ({ ...f, bonus_points: e.target.value }))} /></div>
            {!editingCampaign && <p className="text-xs text-muted-foreground">As missões serão adicionadas após salvar a campanha.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampaignForm(false)}>Cancelar</Button>
            <Button onClick={saveCampaign}>{editingCampaign ? "Salvar" : "Salvar campanha"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Mission ─────────────────────────────── */}
      <Dialog open={showMissionForm} onOpenChange={setShowMissionForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingMission ? "Editar Missão" : "Nova Missão"}</DialogTitle></DialogHeader>
          {missionParentProgram && missionParentCampaign && (
            <div className="bg-secondary/50 rounded-md px-3 py-2 text-xs text-muted-foreground">
              Dentro de › <span className="font-medium text-foreground">{missionParentProgram.emoji} {missionParentProgram.title}</span> › <span className="font-medium text-foreground">{missionParentCampaign.emoji || "🏆"} {missionParentCampaign.title}</span>
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-1"><Label>Nome da missão</Label><Input value={missionForm.title} onChange={e => setMissionForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Pontos</Label><Input type="number" value={missionForm.points} onChange={e => setMissionForm(f => ({ ...f, points: e.target.value }))} /></div>
              <div className="space-y-1">
                <Label>Frequência</Label>
                <Select value={missionForm.frequency} onValueChange={v => setMissionForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQ_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={missionForm.tag} onValueChange={v => setMissionForm(f => ({ ...f, tag: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TAG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Validação</Label>
                <Select value={missionForm.validation_type} onValueChange={v => setMissionForm(f => ({ ...f, validation_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VALIDATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Questionnaire editor - shown when auto_survey */}
            {missionForm.validation_type === "auto_survey" && (
              <div className="space-y-3 border rounded-lg p-3 bg-secondary/20">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">📋 Questionário vinculado</Label>

                {existingQuestionnaires.length > 0 && (
                  <Select value={surveyMode} onValueChange={v => { setSurveyMode(v as "new" | "existing"); setLoadedSurveyQuestions([]); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Criar novo questionário</SelectItem>
                      <SelectItem value="existing">Vincular existente</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {surveyMode === "existing" ? (
                  <>
                    <Select value={surveyQuestionnaireId} onValueChange={v => { setSurveyQuestionnaireId(v); loadSurveyQuestions(v); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione um questionário..." /></SelectTrigger>
                      <SelectContent>
                        {existingQuestionnaires.map(q => <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {loadedSurveyQuestions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">{loadedSurveyQuestions.length} pergunta(s):</p>
                        {loadedSurveyQuestions.map((q, i) => (
                          <div key={i} className="text-xs text-foreground bg-background rounded px-2 py-1">
                            <span className="text-muted-foreground uppercase text-[10px]">{q.category}</span> — {q.question_text}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Input placeholder="Título do questionário (ex: Avaliação de Sono)" value={surveyTitle} onChange={e => setSurveyTitle(e.target.value)} className="h-8 text-sm" />
                    <div className="space-y-2">
                      {surveyQuestions.map((q, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <Input className="w-28 h-8 text-xs" placeholder="Categoria" value={q.category} onChange={e => {
                            const updated = [...surveyQuestions];
                            updated[i] = { ...updated[i], category: e.target.value };
                            setSurveyQuestions(updated);
                          }} />
                          <Input className="flex-1 h-8 text-xs" placeholder="Pergunta" value={q.question_text} onChange={e => {
                            const updated = [...surveyQuestions];
                            updated[i] = { ...updated[i], question_text: e.target.value };
                            setSurveyQuestions(updated);
                          }} />
                          {surveyQuestions.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setSurveyQuestions(q => q.filter((_, idx) => idx !== i))}>
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSurveyQuestions(q => [...q, { category: "Geral", question_text: "" }])}>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar pergunta
                    </Button>
                    <p className="text-[10px] text-muted-foreground">Cada pergunta usa escala 1-5 (😢 a 😄). O colaborador responde e a missão é concluída automaticamente.</p>
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMissionForm(false)}>Cancelar</Button>
            <Button onClick={saveMission}>Salvar missão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === "program" ? "Excluir programa?" : deleteTarget?.type === "campaign" ? "Excluir campanha?" : "Desvincular missão?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "mission"
                ? `Deseja desvincular "${deleteTarget?.title}" desta campanha? A missão não será excluída.`
                : `Tem certeza que deseja excluir "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteTarget?.type === "mission" ? "Desvincular" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
