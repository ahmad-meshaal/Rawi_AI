import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="w-full max-w-md shadow-lg border-border/60">
        <CardContent className="pt-10 pb-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          
          <h1 className="text-4xl font-bold font-heading mb-4 text-foreground">404</h1>
          <h2 className="text-2xl font-bold mb-4 text-foreground">عذراً، الصفحة غير موجودة</h2>
          <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
            يبدو أنك وصلت إلى رابط غير صحيح أو صفحة تم نقلها.
          </p>
          
          <Link href="/">
            <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-all font-bold">
              <Home className="h-5 w-5" />
              العودة للرئيسية
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
