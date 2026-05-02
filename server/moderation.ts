import { openai } from "./replit_integrations/image/client";

const ARABIC_EXPLICIT = [
  "سكس","جنس","إباحي","عري","مداعبة جنسية","فاحشة","فحش","بورن","خيانة جنسية",
  "porn","sex","nude","naked","erotic","xxx","adult content"
];

export async function isContentSafe(text: string): Promise<{ safe: boolean; reason?: string }> {
  if (!text || text.trim().length < 10) return { safe: true };

  const lower = text.toLowerCase();
  for (const word of ARABIC_EXPLICIT) {
    if (lower.includes(word)) {
      return { safe: false, reason: "يحتوي النص على محتوى غير لائق" };
    }
  }

  try {
    const response = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: text.substring(0, 2000),
    });
    const result = response.results[0];
    if (result.flagged) {
      const cats = result.categories as Record<string, boolean>;
      const found: string[] = [];
      if (cats["sexual"])           found.push("محتوى جنسي");
      if (cats["violence"])         found.push("عنف مفرط");
      if (cats["hate"])             found.push("خطاب كراهية");
      if (cats["harassment"])       found.push("تحرش");
      if (cats["self-harm"])        found.push("إيذاء النفس");
      return { safe: false, reason: found.join("، ") || "محتوى غير مقبول" };
    }
    return { safe: true };
  } catch (err) {
    console.error("Moderation error:", err);
    return { safe: true };
  }
}
