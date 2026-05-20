import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { PartnerType } from "./PartnerForm";

interface Props {
  partnerType: PartnerType;
  onDone: () => void;
}

const REQUIRED_COLS: Record<PartnerType, string[]> = {
  doctor: ["name", "crm"],
  clinic: ["name"],
  gym: ["name"],
  laboratory: ["name"],
  pharmacy: ["name"],
  other: ["name"],
};

interface Row {
  data: Record<string, string>;
  errors: string[];
}

export function PartnerCsvImport({ partnerType, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      toast({ title: "CSV vazio ou inválido", variant: "destructive" });
      return;
    }

    const hdrs = lines[0].split(",").map(h => h.trim().toLowerCase());
    setHeaders(hdrs);

    const required = REQUIRED_COLS[partnerType];
    const parsed: Row[] = lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim());
      const data: Record<string, string> = {};
      hdrs.forEach((h, i) => { data[h] = vals[i] || ""; });
      const errors: string[] = [];
      required.forEach(r => {
        if (!data[r]) errors.push(`${r} obrigatório`);
      });
      return { data, errors };
    });

    setRows(parsed);
  };

  const handleImport = async () => {
    const valid = rows.filter(r => r.errors.length === 0);
    if (valid.length === 0) {
      toast({ title: "Nenhuma linha válida para importar", variant: "destructive" });
      return;
    }

    setImporting(true);
    const records = valid.map(r => ({
      partner_type: partnerType,
      name: r.data.name || "",
      email: r.data.email || null,
      phone: r.data.phone || null,
      city: r.data.city || null,
      state: r.data.state || "ES",
      full_address: r.data.full_address || null,
      zip_code: r.data.zip_code || null,
      crm: r.data.crm || null,
      crm_state: r.data.crm_state || null,
      specialty: r.data.specialty || null,
      description: r.data.description || null,
      approval_status: "pending" as const,
      active: false,
    }));

    const { error } = await supabase.from("partners").insert(records);
    setImporting(false);

    if (error) {
      toast({ title: "Erro na importação", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${valid.length} parceiros importados com sucesso` });
      onDone();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="text-sm" />
      </div>

      <p className="text-xs text-muted-foreground">
        Colunas obrigatórias: {REQUIRED_COLS[partnerType].join(", ")}. 
        Colunas opcionais: email, phone, city, state, full_address, zip_code, description
        {partnerType === "doctor" && ", crm_state, specialty"}
      </p>

      {rows.length > 0 && (
        <>
          <div className="max-h-64 overflow-auto border border-border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  {headers.map(h => <TableHead key={h}>{h}</TableHead>)}
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 50).map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs">{idx + 1}</TableCell>
                    {headers.map(h => <TableCell key={h} className="text-xs">{row.data[h]}</TableCell>)}
                    <TableCell>
                      {row.errors.length > 0
                        ? <Badge variant="destructive" className="text-[10px]">{row.errors.join("; ")}</Badge>
                        : <Badge variant="secondary" className="text-[10px]">OK</Badge>
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {rows.filter(r => r.errors.length === 0).length}/{rows.length} linhas válidas
            </p>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importando..." : "Importar válidos"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
