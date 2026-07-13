export const EXTERNAL_SOURCE = "maylaapp";

export type ErrorCode =
  | "invalid_body"
  | "invalid_source"
  | "invalid_ssid"
  | "invalid_external_response"
  | "inactive_external_user";

export class ExternalAuthValidationError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(code);
    this.name = "ExternalAuthValidationError";
  }
}

export interface ExternalAuthRequest {
  source: typeof EXTERNAL_SOURCE;
  ssid: string;
}

export interface ExternalPatient {
  externalSubject: string;
  externalClientId: string | null;
  name: string;
  email: string;
  cpf: string;
  birthDate: string | null;
  biologicalSex: "male" | "female" | null;
  weight: number | null;
  height: number | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  cellphone: string | null;
}

export function hasConflictingUserIds(
  ...userIds: Array<string | null | undefined>
): boolean {
  return new Set(userIds.filter((userId): userId is string => Boolean(userId))).size > 1;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    throw new ExternalAuthValidationError("invalid_external_response");
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new ExternalAuthValidationError("invalid_external_response");
  }
  return normalized;
}

function optionalString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new ExternalAuthValidationError("invalid_external_response");
  }

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new ExternalAuthValidationError("invalid_external_response");
  }
  return normalized;
}

function optionalNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ExternalAuthValidationError("invalid_external_response");
  }
  if (value < minimum || value > maximum) {
    throw new ExternalAuthValidationError("invalid_external_response");
  }
  return value;
}

export function normalizeCpf(value: unknown): string {
  if (typeof value !== "string") {
    throw new ExternalAuthValidationError("invalid_external_response");
  }
  return value.replace(/\D/g, "");
}

export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const digit = 11 - (sum % 11);
    return digit >= 10 ? 0 : digit;
  };

  return calculateDigit(9) === Number(cpf[9]) &&
    calculateDigit(10) === Number(cpf[10]);
}

function normalizeBirthDate(value: unknown): string | null {
  const raw = optionalString(value, 40);
  if (raw === null) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(raw);
  if (!match) {
    throw new ExternalAuthValidationError("invalid_external_response");
  }

  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  const today = new Date();
  const earliest = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    ),
  );
  earliest.setUTCFullYear(today.getUTCFullYear() - 120);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalized ||
    date > today ||
    date < earliest
  ) {
    throw new ExternalAuthValidationError("invalid_external_response");
  }

  return normalized;
}

function normalizeGender(value: unknown): "male" | "female" | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new ExternalAuthValidationError("invalid_external_response");
  }

  const gender = value.trim().toUpperCase();
  if (gender === "M") return "male";
  if (gender === "F") return "female";
  throw new ExternalAuthValidationError("invalid_external_response");
}

function normalizeEmail(value: unknown): string {
  const email = requiredString(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ExternalAuthValidationError("invalid_external_response");
  }
  return email;
}

export function parseExternalAuthRequest(value: unknown): ExternalAuthRequest {
  if (!isObject(value)) {
    throw new ExternalAuthValidationError("invalid_body");
  }

  if (value.source !== EXTERNAL_SOURCE) {
    throw new ExternalAuthValidationError("invalid_source");
  }

  if (
    typeof value.ssid !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(value.ssid)
  ) {
    throw new ExternalAuthValidationError("invalid_ssid");
  }

  return { source: EXTERNAL_SOURCE, ssid: value.ssid.toLowerCase() };
}

export function parseExternalPatient(value: unknown): ExternalPatient {
  if (!isObject(value)) {
    throw new ExternalAuthValidationError("invalid_external_response");
  }
  if (value.is_active !== true) {
    if (value.is_active === false) {
      throw new ExternalAuthValidationError("inactive_external_user");
    }
    throw new ExternalAuthValidationError("invalid_external_response");
  }

  const personalInfo = value.personal_info;
  const addressContact = value.address_contact;
  if (!isObject(personalInfo) || !isObject(addressContact)) {
    throw new ExternalAuthValidationError("invalid_external_response");
  }

  const cpf = normalizeCpf(value.cpf);
  if (!isValidCpf(cpf)) {
    throw new ExternalAuthValidationError("invalid_external_response");
  }

  const state = optionalString(addressContact.state, 2);
  const zipCodeRaw = optionalString(addressContact.zip_code, 20);
  const zipCode = zipCodeRaw?.replace(/\D/g, "") || null;
  if (zipCode !== null && zipCode.length !== 8) {
    throw new ExternalAuthValidationError("invalid_external_response");
  }

  const cellphoneRaw = optionalString(addressContact.cellphone, 30);
  const cellphone = cellphoneRaw?.replace(/\D/g, "") || null;
  if (
    cellphone !== null &&
    (cellphone.length < 10 || cellphone.length > 15)
  ) {
    throw new ExternalAuthValidationError("invalid_external_response");
  }

  return {
    externalSubject: requiredString(value.id, 255),
    externalClientId: optionalString(value.client_id, 255),
    name: requiredString(value.name, 200),
    email: normalizeEmail(value.email),
    cpf,
    birthDate: normalizeBirthDate(personalInfo.date_birth),
    biologicalSex: normalizeGender(personalInfo.gender),
    weight: optionalNumber(personalInfo.weight, 1, 1000),
    height: optionalNumber(personalInfo.height, 0.3, 300),
    city: optionalString(addressContact.city, 120),
    state: state?.toUpperCase() || null,
    zipCode,
    cellphone,
  };
}

export function profileValues(
  patient: ExternalPatient,
  companyId: string,
): Record<string, string | number> {
  const values: Record<string, string | number> = {
    full_name: patient.name,
    cpf: patient.cpf,
    company_id: companyId,
  };

  if (patient.birthDate) values.birth_date = patient.birthDate;
  if (patient.biologicalSex) values.biological_sex = patient.biologicalSex;
  if (patient.weight !== null) values.peso = patient.weight;
  if (patient.height !== null) values.altura = patient.height;
  if (patient.city) values.cidade = patient.city;
  if (patient.state) values.estado = patient.state;
  if (patient.zipCode) values.cep = patient.zipCode;
  if (patient.cellphone) values.phone = patient.cellphone;

  return values;
}
