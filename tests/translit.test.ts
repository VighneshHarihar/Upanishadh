// The reader's script switcher: deterministic Devanagari → Indic transliteration (no AI, no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { transliterate } from "../src/components/reader/translit.ts";

test("tat tvam asi in seven regional scripts", () => {
  assert.equal(transliterate("ब्रह्म", "beng"), "ব্রহ্ম");
  assert.equal(transliterate("ॐ", "telu"), "ఓం");
  assert.equal(transliterate("ब्रह्म", "knda"), "ಬ್ರಹ್ಮ");
  assert.equal(transliterate("ब्रह्म", "mlym"), "ബ്രഹ്മ");
  assert.equal(transliterate("ब्रह्म", "gujr"), "બ્રહ્મ");
  assert.equal(transliterate("ब्रह्म", "orya"), "ବ୍ରହ୍ମ");
});
test("Tamil keeps Sanskrit distinctions with superscripts", () => {
  const t = transliterate("गुह", "taml");
  assert.match(t, /³/, t); // ga is marked
  assert.notEqual(transliterate("क", "taml"), transliterate("ग", "taml"));
});
test("every Devanagari letter leaves the source script", () => {
  for (const to of ["beng", "orya", "gujr", "telu", "knda", "mlym", "taml"] as const) {
    const out = transliterate("ईशा वास्यमिदं सर्वं यत्किञ्च जगत्यां जगत्", to);
    assert.doesNotMatch(out, /[क-हअ-औ]/, `${to}: ${out}`);
  }
});
