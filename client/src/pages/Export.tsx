import { useNovel, useChapters } from "@/hooks/use-novels";
import { LoadingPage } from "@/components/ui/Loading";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useParams, Link } from "wouter";
import { useUser } from "@/context/UserContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Printer, FileText, UserPlus, UserMinus, User } from "lucide-react";
// @ts-ignore
import html2pdf from "html2pdf.js";

interface AuthorProfile {
  id: number;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  novels: { id: number }[];
}

export default function Export() {
  const { id } = useParams();
  const novelId = parseInt(id!);
  const { data: novel, isLoading: isNovelLoading } = useNovel(novelId);
  const { data: chapters, isLoading: isChaptersLoading } = useChapters(novelId);
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const authorUsername = (novel as any)?.authorUsername as string | null | undefined;
  const authorAvatarUrl = (novel as any)?.authorAvatarUrl as string | null | undefined;

  const { data: authorProfile } = useQuery<AuthorProfile>({
    queryKey: ["/api/users", authorUsername, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${authorUsername}/profile`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: !!authorUsername,
  });

  const followMutation = useMutation({
    mutationFn: async (action: "follow" | "unfollow") => {
      if (action === "follow") {
        await apiRequest("POST", `/api/users/${authorUsername}/follow`);
      } else {
        await apiRequest("DELETE", `/api/users/${authorUsername}/follow`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", authorUsername, "profile"] });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  if (isNovelLoading || isChaptersLoading || !novel) return <LoadingPage />;

  const sortedChapters = chapters?.sort((a, b) => a.sequenceNumber - b.sequenceNumber) || [];
  const isOwnNovel = user && (novel as any).authorId === user.id;
  const isFollowing = authorProfile?.isFollowing ?? false;

  const downloadPDF = async () => {
    const element = document.getElementById('printable-content');
    if (!element) return;
    const header = document.querySelector('.no-print') as HTMLElement;
    if (header) header.style.display = 'none';
    const opt = {
      margin: [15, 15],
      filename: `${novel.title}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 1.5,
        useCORS: true,
        letterRendering: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1200,
        logging: false,
        onclone: (clonedDoc: Document) => {
          const clonedElement = clonedDoc.getElementById('printable-content');
          if (clonedElement) {
            clonedElement.style.paddingTop = '20px';
            clonedElement.style.marginTop = '0px';
            clonedElement.style.position = 'relative';
            clonedElement.style.display = 'block';
            clonedElement.style.backgroundColor = 'white';
            clonedElement.style.width = '1200px';
            clonedElement.style.color = 'black';
            clonedElement.style.visibility = 'visible';
            clonedElement.style.opacity = '1';
            clonedDoc.body.style.backgroundColor = 'white';
            const makeVisible = (el: HTMLElement) => {
              el.style.setProperty('color', 'black', 'important');
              el.style.setProperty('fill', 'black', 'important');
              el.style.setProperty('background-color', 'white', 'important');
              el.style.setProperty('visibility', 'visible', 'important');
              el.style.setProperty('opacity', '1', 'important');
              const style = window.getComputedStyle(el);
              if (style.display === 'none') el.style.setProperty('display', 'block', 'important');
              for (let i = 0; i < el.children.length; i++) makeVisible(el.children[i] as HTMLElement);
            };
            makeVisible(clonedElement);
            const images = clonedElement.getElementsByTagName('img');
            for (let i = 0; i < images.length; i++) {
              images[i].style.setProperty('display', 'block', 'important');
              images[i].style.setProperty('visibility', 'visible', 'important');
            }
          }
        }
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    try {
      await html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf: any) => {}).save();
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      if (header) header.style.display = 'flex';
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Top Bar */}
      <div className="no-print fixed top-0 w-full bg-slate-900 text-white p-4 flex justify-between items-center z-50 shadow-lg">
        <div className="flex items-center gap-4">
          <Link href={`/novels/${novelId}`}>
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <ArrowRight className="h-4 w-4 ml-2" />
              العودة
            </Button>
          </Link>
          <span className="font-bold">{novel.title} - معاينة الطباعة</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadPDF} variant="outline" className="bg-transparent text-white border-white/20 hover:bg-white/10">
            <FileText className="h-4 w-4 ml-2" />
            تحميل PDF
          </Button>
          <Button onClick={() => window.print()} className="bg-white text-slate-900 hover:bg-white/90">
            <Printer className="h-4 w-4 ml-2" />
            طباعة
          </Button>
        </div>
      </div>

      {/* Printable Content */}
      <div id="printable-content" className="max-w-[21cm] mx-auto bg-white pt-24 pb-12 print:pt-0 print:pb-0">

        {/* Title Page */}
        <div className="min-h-[29.7cm] flex flex-col items-center justify-center text-center p-12 mb-8 print-break-before">
          {novel.coverUrl && (
            <img
              src={novel.coverUrl}
              alt={novel.title}
              className="w-48 h-72 object-cover rounded-xl shadow-2xl mb-10"
            />
          )}
          <h1 className="text-6xl font-heading font-bold mb-6">{novel.title}</h1>
          <p className="text-2xl text-gray-500 mb-4">{novel.genre}</p>

          {/* Author on Title Page */}
          {authorUsername && (
            <div className="flex items-center gap-3 mt-6 justify-center">
              <Avatar className="h-10 w-10 border border-gray-200">
                <AvatarImage src={authorAvatarUrl || undefined} />
                <AvatarFallback className="text-sm font-bold bg-gray-100 text-gray-600">
                  {authorUsername.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-right">
                <p className="text-sm text-gray-400">تأليف</p>
                <p className="font-bold text-gray-700 text-lg">{authorUsername}</p>
              </div>
            </div>
          )}

          <div className="w-24 h-1 bg-black mt-10 mb-8"></div>
          <p className="text-lg italic max-w-lg text-gray-500 leading-relaxed">{novel.synopsis}</p>
        </div>

        {/* Chapters */}
        <div className="print-content">
          {sortedChapters.map((chapter) => (
            <div key={chapter.id} className="mb-12 print-break-before px-12 py-8">
              <div className="text-center mb-12">
                <span className="text-sm uppercase tracking-widest text-gray-500 block mb-2 font-ui">
                  الفصل {chapter.sequenceNumber}
                </span>
                <h2 className="text-4xl font-heading font-bold">{chapter.title}</h2>
              </div>
              <div className="prose prose-lg prose-p:text-justify max-w-none font-body leading-loose text-gray-900 text-xl">
                {chapter.content ? (
                  chapter.content.split('\n').map((paragraph, i) =>
                    paragraph.trim() && <p key={i} className="indent-8 mb-4">{paragraph}</p>
                  )
                ) : (
                  <p className="text-center text-gray-400 italic">[فصل فارغ]</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* End */}
        <div className="min-h-[30vh] flex items-center justify-center print-break-before mt-16">
          <p className="text-xl font-bold">— تمت —</p>
        </div>

        {/* Author Card */}
        {authorUsername && (
          <div className="no-print mt-4 mx-6 mb-10 rounded-2xl border border-gray-200 bg-gradient-to-l from-primary/5 to-transparent p-8" dir="rtl">
            <p className="text-xs text-muted-foreground font-medium mb-5 tracking-wide uppercase">عن الكاتب</p>
            <div className="flex items-center gap-5 flex-wrap">
              <Link href={`/profile/${authorUsername}`}>
                <Avatar className="h-20 w-20 border-2 border-primary/20 cursor-pointer hover:border-primary transition-colors shadow-md">
                  <AvatarImage src={authorAvatarUrl || undefined} />
                  <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                    {authorUsername.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/profile/${authorUsername}`}>
                  <h3 className="text-2xl font-bold text-gray-900 hover:text-primary transition-colors cursor-pointer mb-1">
                    {authorUsername}
                  </h3>
                </Link>
                {authorProfile && (
                  <p className="text-sm text-muted-foreground">
                    {authorProfile.followerCount.toLocaleString("ar")} متابع
                    {" · "}
                    {authorProfile.novels.length} رواية
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link href={`/profile/${authorUsername}`}>
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-view-profile">
                    <User className="h-4 w-4" />
                    الملف الشخصي
                  </Button>
                </Link>
                {!isOwnNovel && (
                  user ? (
                    <Button
                      size="sm"
                      variant={isFollowing ? "outline" : "default"}
                      className="gap-2"
                      disabled={followMutation.isPending}
                      data-testid="button-follow-author"
                      onClick={() => followMutation.mutate(isFollowing ? "unfollow" : "follow")}
                    >
                      {isFollowing ? (
                        <><UserMinus className="h-4 w-4" />إلغاء المتابعة</>
                      ) : (
                        <><UserPlus className="h-4 w-4" />متابعة الكاتب</>
                      )}
                    </Button>
                  ) : (
                    <Link href="/login">
                      <Button size="sm" className="gap-2" data-testid="button-login-to-follow">
                        <UserPlus className="h-4 w-4" />
                        متابعة الكاتب
                      </Button>
                    </Link>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
