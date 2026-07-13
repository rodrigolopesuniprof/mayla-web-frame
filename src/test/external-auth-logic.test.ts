import { describe, expect, it } from "vitest";
import {
  ExternalAuthValidationError,
  hasConflictingUserIds,
  isValidCpf,
  parseExternalAuthRequest,
  parseExternalPatient,
  profileValues,
} from "../../supabase/functions/external-auth/logic";

const validResponse = {
  id: "patient-123",
  name: "  Nome da Pessoa  ",
  email: "PESSOA@EXAMPLE.COM",
  cpf: "529.982.247-25",
  password: "must-never-be-used",
  is_active: true,
  client_id: "client-456",
  personal_info: {
    weight: 70,
    height: 170,
    date_birth: "1990-05-20T00:00:00.000Z",
    gender: "F",
  },
  address_contact: {
    city: "Vitória",
    state: "es",
    zip_code: "29000-000",
    cellphone: "(27) 99999-9999",
  },
};

describe("parseExternalAuthRequest", () => {
  it("accepts only maylaapp with a UUID", () => {
    expect(parseExternalAuthRequest({
      source: "maylaapp",
      ssid: "019ecb3b-c3c0-728e-9614-89b44853777a",
    })).toEqual({
      source: "maylaapp",
      ssid: "019ecb3b-c3c0-728e-9614-89b44853777a",
    });
  });

  it.each([
    [{ source: "other", ssid: "019ecb3b-c3c0-728e-9614-89b44853777a" }, "invalid_source"],
    [{ source: "maylaapp", ssid: "not-a-uuid" }, "invalid_ssid"],
    [null, "invalid_body"],
  ])("rejects invalid requests", (value, code) => {
    expect(() => parseExternalAuthRequest(value)).toThrowError(
      expect.objectContaining({ code }),
    );
  });
});

describe("CPF validation", () => {
  it.each([
    ["52998224725", true],
    ["52998224724", false],
    ["11111111111", false],
    ["529.982.247-25", false],
  ])("validates %s", (cpf, expected) => {
    expect(isValidCpf(cpf)).toBe(expected);
  });
});

describe("external identity resolution", () => {
  it("accepts candidate identifiers that all point to one user", () => {
    expect(hasConflictingUserIds("user-1", "user-1", "user-1")).toBe(false);
    expect(hasConflictingUserIds("user-1", null, undefined)).toBe(false);
  });

  it("rejects a conflict from any identity, CPF or email candidate", () => {
    expect(hasConflictingUserIds("user-1", "user-1", "user-2")).toBe(true);
    expect(hasConflictingUserIds("user-1", null, "user-2")).toBe(true);
  });
});

describe("parseExternalPatient", () => {
  it("normalizes the allowlisted fields and ignores password", () => {
    const patient = parseExternalPatient(validResponse);

    expect(patient).toEqual({
      externalSubject: "patient-123",
      externalClientId: "client-456",
      name: "Nome da Pessoa",
      email: "pessoa@example.com",
      cpf: "52998224725",
      birthDate: "1990-05-20",
      biologicalSex: "female",
      weight: 70,
      height: 170,
      city: "Vitória",
      state: "ES",
      zipCode: "29000000",
      cellphone: "27999999999",
    });
    expect(JSON.stringify(patient)).not.toContain("must-never-be-used");
  });

  it("accepts nullable optional profile fields", () => {
    const patient = parseExternalPatient({
      ...validResponse,
      personal_info: {
        weight: null,
        height: null,
        date_birth: null,
        gender: null,
      },
      address_contact: {
        city: null,
        state: null,
        zip_code: null,
        cellphone: null,
      },
    });

    expect(patient.birthDate).toBeNull();
    expect(patient.biologicalSex).toBeNull();
    expect(profileValues(patient, "company-id")).toEqual({
      full_name: "Nome da Pessoa",
      cpf: "52998224725",
      company_id: "company-id",
    });
  });

  it.each([
    [{ ...validResponse, cpf: "111.111.111-11" }, "invalid_external_response"],
    [{ ...validResponse, email: null }, "invalid_external_response"],
    [{ ...validResponse, is_active: false }, "inactive_external_user"],
    [{
      ...validResponse,
      personal_info: { ...validResponse.personal_info, gender: "X" },
    }, "invalid_external_response"],
  ])("rejects invalid external data", (value, code) => {
    try {
      parseExternalPatient(value);
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ExternalAuthValidationError);
      expect((error as ExternalAuthValidationError).code).toBe(code);
    }
  });
});
