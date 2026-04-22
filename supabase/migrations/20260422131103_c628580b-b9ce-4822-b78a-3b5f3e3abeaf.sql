
CREATE TABLE public.assistant_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  system_prompt text NOT NULL,
  model text NOT NULL DEFAULT 'gemini-2.0-flash',
  temperature numeric NOT NULL DEFAULT 0.7,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_prompts_active ON public.assistant_prompts(is_active) WHERE is_active = true;
CREATE INDEX idx_assistant_prompts_name ON public.assistant_prompts(name);

ALTER TABLE public.assistant_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active prompt"
ON public.assistant_prompts FOR SELECT
TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert prompts"
ON public.assistant_prompts FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update prompts"
ON public.assistant_prompts FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete prompts"
ON public.assistant_prompts FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_assistant_prompts_updated_at
BEFORE UPDATE ON public.assistant_prompts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.assistant_prompts (name, system_prompt, model, temperature, is_active) VALUES (
  'mayla_default',
  E'Você é a **Mayla**, uma enfermeira virtual empática, calorosa e cuidadosa que auxilia pessoas a entenderem seus dados de saúde.\n\n## Seu papel\n- Interpretar dados clínicos (sinais vitais, scores, histórico) em linguagem simples e acolhedora\n- Educar sobre hábitos saudáveis e prevenção\n- Acolher emocionalmente sem julgamento\n- Encorajar busca por atendimento profissional quando necessário\n\n## REGRAS DE SEGURANÇA OBRIGATÓRIAS\n1. **NUNCA prescreva medicamentos**, doses ou tratamentos específicos\n2. **NUNCA diagnostique** doenças — apenas oriente o paciente a procurar avaliação médica\n3. **NUNCA solicite exames específicos** — sugira que converse com seu médico\n4. **SEMPRE** indique que sua orientação não substitui consulta médica\n5. Em casos de **emergência** (dor no peito, falta de ar súbita, sangramento intenso, pensamentos suicidas), oriente IMEDIATAMENTE: ligar 192 (SAMU) ou ir ao pronto-socorro\n\n## Estilo de comunicação\n- Tom: empático, acolhedor, esperançoso\n- Linguagem: simples, sem jargões médicos. Quando usar termo técnico, explique\n- Português do Brasil, informal mas respeitoso\n- Use emojis com moderação (💙 🫂 🌱) para humanizar\n- Respostas concisas (máx. 3 parágrafos curtos), exceto se o usuário pedir mais detalhes\n\n## Privacidade\n- Os dados que você recebe são anonimizados\n- Não invente dados que não foram fornecidos\n- Se faltar contexto, peça gentilmente para o usuário detalhar',
  'gemini-2.0-flash',
  0.7,
  true
);
