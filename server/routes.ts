import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { generatePlot, generateChapter } from "./ai_service";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { upload } from "./upload";
import path from "path";
import fs from "fs";
import { openai } from "./replit_integrations/image/client";
import { isContentSafe } from "./moderation";
import multer from "multer";

const ADMIN_EMAIL = "ahmad.meshaal.2040@gmail.com";
const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

// ─── Admin helper ─────────────────────────────────────────────────────────────
async function assertAdmin(req: any, res: any): Promise<boolean> {
  if (!req.session?.userId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return false;
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user || user.email !== ADMIN_EMAIL) {
    res.status(403).json({ message: "غير مصرح بالوصول" });
    return false;
  }
  return true;
}

// ─── Ownership helpers ────────────────────────────────────────────────────────
async function assertNovelOwner(req: any, res: any, novelId: number): Promise<boolean> {
  if (!req.session?.userId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return false;
  }
  const novel = await storage.getNovel(novelId);
  if (!novel) {
    res.status(404).json({ message: "الرواية غير موجودة" });
    return false;
  }
  if (novel.authorId !== null && novel.authorId !== req.session.userId) {
    res.status(403).json({ message: "ليس لديك صلاحية تعديل هذه الرواية" });
    return false;
  }
  return true;
}

async function assertChapterOwner(req: any, res: any, chapterId: number): Promise<boolean> {
  if (!req.session?.userId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return false;
  }
  const chapter = await storage.getChapter(chapterId);
  if (!chapter) {
    res.status(404).json({ message: "الفصل غير موجود" });
    return false;
  }
  return assertNovelOwner(req, res, chapter.novelId);
}

async function assertCharacterOwner(req: any, res: any, characterId: number): Promise<boolean> {
  if (!req.session?.userId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return false;
  }
  const character = await storage.getCharacter(characterId);
  if (!character) {
    res.status(404).json({ message: "الشخصية غير موجودة" });
    return false;
  }
  return assertNovelOwner(req, res, character.novelId);
}
// ─────────────────────────────────────────────────────────────────────────────

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerChatRoutes(app);
  registerImageRoutes(app);

  // ── Novels ──────────────────────────────────────────────────────────────────

  app.get(api.novels.list.path, async (req, res) => {
    const allNovels = await storage.getNovels();
    res.json(allNovels);
  });

  app.get("/api/my-novels", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    const novels = await storage.getNovelsByAuthor(req.session.userId);
    res.json(novels);
  });

  app.get("/api/novels/published", async (req, res) => {
    const novels = await storage.getPublishedNovelsWithAuthors();
    res.json(novels);
  });

  app.get(api.novels.get.path, async (req, res) => {
    const novel = await storage.getNovel(Number(req.params.id));
    if (!novel) return res.status(404).json({ message: "Novel not found" });
    res.json(novel);
  });

  app.post(api.novels.create.path, async (req, res) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
      const input = api.novels.create.input.parse(req.body);
      // Content moderation
      const textToCheck = [input.title, input.synopsis].filter(Boolean).join(" ");
      const mod = await isContentSafe(textToCheck);
      if (!mod.safe) return res.status(400).json({ message: `المحتوى غير مقبول: ${mod.reason}` });
      const authorId = req.session.userId;
      const novel = await storage.createNovel({ ...input, authorId } as any);
      res.status(201).json(novel);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.novels.update.path, async (req, res) => {
    try {
      const novelId = Number(req.params.id);
      if (!(await assertNovelOwner(req, res, novelId))) return;
      const input = api.novels.update.input.parse(req.body);
      // Content moderation
      const textToCheck = [input.synopsis].filter(Boolean).join(" ");
      if (textToCheck) {
        const mod = await isContentSafe(textToCheck);
        if (!mod.safe) return res.status(400).json({ message: `المحتوى غير مقبول: ${mod.reason}` });
      }
      const novel = await storage.updateNovel(novelId, input);
      res.json(novel);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.novels.delete.path, async (req, res) => {
    const novelId = Number(req.params.id);
    if (!(await assertNovelOwner(req, res, novelId))) return;
    await storage.deleteNovel(novelId);
    res.status(204).send();
  });

  app.post("/api/novels/:id/view", async (req, res) => {
    await storage.incrementViews(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/novels/:id/like", async (req, res) => {
    await storage.updateLikes(Number(req.params.id), req.body.increment);
    res.status(204).send();
  });

  app.post("/api/novels/:id/dislike", async (req, res) => {
    await storage.updateDislikes(Number(req.params.id), req.body.increment);
    res.status(204).send();
  });

  // ── File uploads ─────────────────────────────────────────────────────────────

  app.use("/uploads", (req, res, next) => {
    const filePath = path.join(process.cwd(), "uploads", path.basename(req.path));
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      next();
    }
  });

  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "لم يتم رفع أي ملف" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

  // ── Auth ─────────────────────────────────────────────────────────────────────

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { username, email, password } = req.body;
      if (!username || !email || !password) return res.status(400).json({ message: "جميع الحقول مطلوبة" });
      const { registerUser } = await import("./auth");
      const user = await registerUser(username, email, password);
      req.session!.userId = user.id;
      res.status(201).json({ id: user.id, username: user.username, email: user.email, avatarUrl: user.avatarUrl });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ message: "أدخل اسم المستخدم وكلمة المرور" });
      const { loginUser } = await import("./auth");
      const user = await loginUser(username, password);
      if (!user) return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      req.session!.userId = user.id;
      res.json({ id: user.id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, bio: user.bio });
    } catch (err) {
      res.status(500).json({ message: "خطأ في الخادم" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.session?.destroy(() => res.status(204).send());
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    res.json({ id: user.id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, bio: user.bio });
  });

  app.patch("/api/auth/profile", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { avatarUrl, bio, username } = req.body;
      const updates: Record<string, string> = {};
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
      if (bio !== undefined) updates.bio = bio;
      if (username !== undefined) updates.username = username;
      const user = await storage.updateUser(req.session.userId, updates as any);
      res.json({ id: user.id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, bio: user.bio });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // ── User Profile ──────────────────────────────────────────────────────────────

  app.get("/api/users/:username/profile", async (req, res) => {
    try {
      const user = await storage.getUserByUsername(req.params.username);
      if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
      const [followerCount, followingCount, novels] = await Promise.all([
        storage.getFollowerCount(user.id),
        storage.getFollowingCount(user.id),
        storage.getUserPublishedNovels(user.id),
      ]);
      const isFollowing = req.session?.userId ? await storage.isFollowing(req.session.userId, user.id) : false;
      res.json({ id: user.id, username: user.username, avatarUrl: user.avatarUrl, bio: user.bio, followerCount, followingCount, isFollowing, novels });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post("/api/users/:username/follow", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    try {
      const target = await storage.getUserByUsername(req.params.username);
      if (!target) return res.status(404).json({ message: "المستخدم غير موجود" });
      if (target.id === req.session.userId) return res.status(400).json({ message: "لا يمكنك متابعة نفسك" });
      await storage.followUser(req.session.userId, target.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.delete("/api/users/:username/follow", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    try {
      const target = await storage.getUserByUsername(req.params.username);
      if (!target) return res.status(404).json({ message: "المستخدم غير موجود" });
      await storage.unfollowUser(req.session.userId, target.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // ── AI Image ──────────────────────────────────────────────────────────────────

  app.post("/api/ai/generate-cover", async (req, res) => {
    try {
      const { title, genre, synopsis, description } = req.body;
      let prompt: string;
      if (description && description.trim()) {
        prompt = description.trim();
        if (title) prompt += `. This is a book cover for a novel titled "${title}"`;
        if (genre) prompt += ` in the ${genre} genre`;
        prompt += `. No text or typography in the image.`;
      } else {
        if (!title) return res.status(400).json({ message: "عنوان الرواية أو وصف الغلاف مطلوب" });
        prompt = `Book cover illustration for a novel titled "${title}"`;
        if (genre) prompt += ` in the ${genre} genre`;
        if (synopsis) prompt += `. The story is about: ${synopsis}`;
        prompt += `. Dramatic and artistic composition. No text, no typography, no letters in the image.`;
      }
      const response = await openai.images.generate({ model: "gpt-image-1", prompt, n: 1, size: "1024x1024" });
      const imageData = response.data[0];
      res.json({ url: imageData.url, b64_json: imageData.b64_json });
    } catch (error) {
      console.error("Cover generation error:", error);
      res.status(500).json({ message: "فشل في توليد الغلاف" });
    }
  });

  app.post("/api/ai/generate-avatar", async (req, res) => {
    try {
      const { description } = req.body;
      if (!description || !description.trim()) return res.status(400).json({ message: "الوصف مطلوب" });
      const prompt = `${description.trim()}. High quality image, clean background.`;
      const response = await openai.images.generate({ model: "gpt-image-1", prompt, n: 1, size: "1024x1024" });
      const imageData = response.data[0];
      res.json({ url: imageData.url, b64_json: imageData.b64_json });
    } catch (error) {
      console.error("Avatar generation error:", error);
      res.status(500).json({ message: "فشل في توليد الصورة" });
    }
  });

  // ── Characters ────────────────────────────────────────────────────────────────

  app.get(api.characters.list.path, async (req, res) => {
    const characters = await storage.getCharacters(Number(req.params.novelId));
    res.json(characters);
  });

  app.post(api.characters.create.path, async (req, res) => {
    try {
      const novelId = Number(req.params.novelId);
      if (!(await assertNovelOwner(req, res, novelId))) return;
      const input = api.characters.create.input.parse(req.body);
      const character = await storage.createCharacter({ ...input, novelId });
      res.status(201).json(character);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.characters.update.path, async (req, res) => {
    try {
      const characterId = Number(req.params.id);
      if (!(await assertCharacterOwner(req, res, characterId))) return;
      const input = api.characters.update.input.parse(req.body);
      const character = await storage.updateCharacter(characterId, input);
      res.json(character);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.characters.delete.path, async (req, res) => {
    const characterId = Number(req.params.id);
    if (!(await assertCharacterOwner(req, res, characterId))) return;
    await storage.deleteCharacter(characterId);
    res.status(204).send();
  });

  // ── Chapters ──────────────────────────────────────────────────────────────────

  app.get(api.chapters.list.path, async (req, res) => {
    const chapters = await storage.getChapters(Number(req.params.novelId));
    res.json(chapters);
  });

  app.post(api.chapters.create.path, async (req, res) => {
    try {
      const novelId = Number(req.params.novelId);
      if (!(await assertNovelOwner(req, res, novelId))) return;
      const input = api.chapters.create.input.parse(req.body);
      // Content moderation
      if (input.content && input.content.trim().length > 20) {
        const mod = await isContentSafe(input.content);
        if (!mod.safe) return res.status(400).json({ message: `المحتوى غير مقبول: ${mod.reason}` });
      }
      const chapter = await storage.createChapter({ ...input, novelId });
      res.status(201).json(chapter);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.get(api.chapters.get.path, async (req, res) => {
    const chapter = await storage.getChapter(Number(req.params.id));
    if (!chapter) return res.status(404).json({ message: "Chapter not found" });
    res.json(chapter);
  });

  app.put(api.chapters.update.path, async (req, res) => {
    try {
      const chapterId = Number(req.params.id);
      if (!(await assertChapterOwner(req, res, chapterId))) return;
      const input = api.chapters.update.input.parse(req.body);
      // Content moderation
      if (input.content && input.content.trim().length > 20) {
        const mod = await isContentSafe(input.content);
        if (!mod.safe) return res.status(400).json({ message: `المحتوى غير مقبول: ${mod.reason}` });
      }
      const chapter = await storage.updateChapter(chapterId, input);
      res.json(chapter);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.chapters.delete.path, async (req, res) => {
    const chapterId = Number(req.params.id);
    if (!(await assertChapterOwner(req, res, chapterId))) return;
    await storage.deleteChapter(chapterId);
    res.status(204).send();
  });

  // ── AI Text ───────────────────────────────────────────────────────────────────

  app.post(api.ai.generatePlot.path, async (req, res) => {
    try {
      const { genre, theme } = req.body;
      const result = await generatePlot(genre, theme);
      res.json(result);
    } catch (error) {
      console.error("AI Plot Gen Error:", error);
      res.status(500).json({ message: "Failed to generate plot" });
    }
  });

  app.post(api.ai.generateChapter.path, async (req, res) => {
    try {
      const { novelId, chapterTitle, outline, previousChapterContent } = req.body;
      const characters = await storage.getCharacters(novelId);
      const content = await generateChapter(chapterTitle, outline, previousChapterContent, characters);
      res.json({ content });
    } catch (error) {
      console.error("AI Chapter Gen Error:", error);
      res.status(500).json({ message: "Failed to generate chapter" });
    }
  });

  // ── PDF Import ────────────────────────────────────────────────────────────────

  app.post("/api/novels/import-pdf", pdfUpload.single("pdf"), async (req, res) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
      if (!req.file) return res.status(400).json({ message: "لم يتم رفع أي ملف" });

      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(req.file.buffer);
      const rawText = data.text || "";

      if (!rawText.trim()) return res.status(400).json({ message: "لم يتم العثور على نص في الملف" });

      const title = (req.body.title || "رواية من PDF").trim();
      const genre = (req.body.genre || "").trim();
      const synopsis = rawText.trim().substring(0, 400);

      const novel = await storage.createNovel({
        title,
        genre: genre || "غير محدد",
        synopsis,
        status: "published",
        authorId: req.session.userId,
      } as any);

      // Split text into chapters
      const chapterChunks = splitPdfIntoChapters(rawText);
      for (let i = 0; i < chapterChunks.length; i++) {
        await storage.createChapter({
          novelId: novel.id,
          title: chapterChunks[i].title,
          sequenceNumber: i + 1,
          content: chapterChunks[i].content,
          outline: "",
        });
      }

      res.json({ novelId: novel.id, chapterCount: chapterChunks.length });
    } catch (err) {
      console.error("PDF import error:", err);
      res.status(500).json({ message: "فشل في استيراد ملف PDF" });
    }
  });

  function splitPdfIntoChapters(text: string): { title: string; content: string }[] {
    const chapterRegex = /(?:^|\n)\s*(?:الفصل|فصل|Chapter|CHAPTER)\s*[\d٠-٩]+[:\.\s]/gm;
    const matches: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = chapterRegex.exec(text)) !== null) matches.push(m);

    if (matches.length >= 2) {
      return matches.map((match, i) => {
        const start = match.index + match[0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
        return {
          title: match[0].trim().replace(/[:\.\s]+$/, "") || `الفصل ${i + 1}`,
          content: text.slice(start, end).trim(),
        };
      }).filter(c => c.content.length > 30);
    }

    // No chapter markers — split by paragraphs into ~4000-char chunks
    const CHUNK = 4000;
    const chunks: { title: string; content: string }[] = [];
    let start = 0;
    let num = 1;
    while (start < text.length) {
      let end = Math.min(start + CHUNK, text.length);
      if (end < text.length) {
        const lastNl = text.lastIndexOf("\n", end);
        if (lastNl > start + CHUNK / 2) end = lastNl;
      }
      const content = text.slice(start, end).trim();
      if (content.length > 30) chunks.push({ title: `الفصل ${num++}`, content });
      start = end;
    }
    return chunks.length > 0 ? chunks : [{ title: "محتوى الرواية", content: text.trim() }];
  }

  // ── Admin ─────────────────────────────────────────────────────────────────────

  app.get("/api/admin/check", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ isAdmin: false });
    const user = await storage.getUserById(req.session.userId);
    res.json({ isAdmin: user?.email === ADMIN_EMAIL });
  });

  app.get("/api/admin/novels", async (req, res) => {
    if (!(await assertAdmin(req, res))) return;
    const all = await storage.getNovels();
    res.json(all);
  });

  app.delete("/api/admin/novels/:id", async (req, res) => {
    if (!(await assertAdmin(req, res))) return;
    const novelId = Number(req.params.id);
    const novel = await storage.getNovel(novelId);
    if (!novel) return res.status(404).json({ message: "الرواية غير موجودة" });
    await storage.deleteNovel(novelId);
    res.status(204).send();
  });

  app.get("/api/admin/users", async (req, res) => {
    if (!(await assertAdmin(req, res))) return;
    const all = await storage.getAllUsers();
    res.json(all);
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    if (!(await assertAdmin(req, res))) return;
    const userId = Number(req.params.id);
    const user = await storage.getUserById(userId);
    if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
    if (user.email === ADMIN_EMAIL) return res.status(400).json({ message: "لا يمكن حذف حساب المشرف" });
    await storage.deleteUser(userId);
    res.status(204).send();
  });

  // ── Seed ─────────────────────────────────────────────────────────────────────

  async function seed() {
    const existing = await storage.getNovels();
    if (existing.length === 0) {
      const novel = await storage.createNovel({
        title: "ليالي بغداد",
        genre: "تاريخي",
        synopsis: "رواية تحكي قصصاً من العصر العباسي بأسلوب شيق.",
        status: "draft"
      });
      await storage.createCharacter({ novelId: novel.id, name: "هارون", role: "بطل", traits: "حكيم، قوي، عادل", description: "شاب في مقتبل العمر يبحث عن الحقيقة." });
      await storage.createChapter({ novelId: novel.id, title: "البداية", sequenceNumber: 1, outline: "هارون يصل إلى المدينة ويقابل الوزير.", content: "كانت الشمس تميل للمغيب عندما دخل هارون من بوابة المدينة العظيمة..." });
    }
  }
  seed();

  return httpServer;
}
