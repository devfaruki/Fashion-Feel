"use client";

import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { Ruler, Shirt, Info } from "lucide-react";

const tops = [
  { size: "XS", bust: "32", waist: "26", hip: "34" },
  { size: "S", bust: "34", waist: "28", hip: "36" },
  { size: "M", bust: "36", waist: "30", hip: "38" },
  { size: "L", bust: "38", waist: "32", hip: "40" },
  { size: "XL", bust: "40", waist: "34", hip: "42" },
  { size: "XXL", bust: "42", waist: "36", hip: "44" },
];

const bottoms = [
  { size: "XS", waist: "26", hip: "34", length: "38" },
  { size: "S", waist: "28", hip: "36", length: "39" },
  { size: "M", waist: "30", hip: "38", length: "40" },
  { size: "L", waist: "32", hip: "40", length: "40" },
  { size: "XL", waist: "34", hip: "42", length: "41" },
  { size: "XXL", waist: "36", hip: "44", length: "41" },
];

export default function SizeGuide() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pb-24">
        <section className="container py-12 md:py-16 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-accent mb-3">Find your fit</p>
          <h1 className="font-serif text-4xl md:text-5xl text-foreground">Size Guide</h1>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
            Measurements are in inches. If you're between sizes, we recommend going one size up.
          </p>
        </section>

        <section className="container grid md:grid-cols-3 gap-5 mb-14">
          {[
            { i: Ruler, t: "Bust", d: "Measure around the fullest part of your bust, keeping the tape level." },
            { i: Shirt, t: "Waist", d: "Measure around the narrowest part of your natural waistline." },
            { i: Info, t: "Hip", d: "Measure around the fullest part of your hips, about 8\" below the waist." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="border border-border bg-card p-6">
              <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Icon className="h-5 w-5" />
              </div>
              <p className="font-medium text-foreground">{t}</p>
              <p className="text-sm text-muted-foreground mt-1">{d}</p>
            </div>
          ))}
        </section>

        <section className="container max-w-4xl space-y-12">
          <div>
            <h2 className="font-serif text-2xl text-foreground mb-4">Tops &amp; Kurtas</h2>
            <div className="overflow-x-auto border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-foreground">
                  <tr>
                    <th className="text-left p-3 font-medium">Size</th>
                    <th className="text-left p-3 font-medium">Bust (in)</th>
                    <th className="text-left p-3 font-medium">Waist (in)</th>
                    <th className="text-left p-3 font-medium">Hip (in)</th>
                  </tr>
                </thead>
                <tbody>
                  {tops.map((r, i) => (
                    <tr key={r.size} className={i % 2 ? "bg-secondary/20" : ""}>
                      <td className="p-3 font-medium text-foreground">{r.size}</td>
                      <td className="p-3 text-muted-foreground">{r.bust}</td>
                      <td className="p-3 text-muted-foreground">{r.waist}</td>
                      <td className="p-3 text-muted-foreground">{r.hip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-foreground mb-4">Bottoms &amp; Trousers</h2>
            <div className="overflow-x-auto border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-foreground">
                  <tr>
                    <th className="text-left p-3 font-medium">Size</th>
                    <th className="text-left p-3 font-medium">Waist (in)</th>
                    <th className="text-left p-3 font-medium">Hip (in)</th>
                    <th className="text-left p-3 font-medium">Length (in)</th>
                  </tr>
                </thead>
                <tbody>
                  {bottoms.map((r, i) => (
                    <tr key={r.size} className={i % 2 ? "bg-secondary/20" : ""}>
                      <td className="p-3 font-medium text-foreground">{r.size}</td>
                      <td className="p-3 text-muted-foreground">{r.waist}</td>
                      <td className="p-3 text-muted-foreground">{r.hip}</td>
                      <td className="p-3 text-muted-foreground">{r.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-card border border-border p-6">
            <h3 className="font-serif text-xl text-foreground mb-2">Unstitched fabrics</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Most unstitched suits come in standard 2.5m shirt, 2.5m dupatta, and 2.5m trouser cuts — enough for sizes
              up to XL. For XXL or longer kameez, we recommend ordering an extra meter. Our team can help you choose —
              just message us on WhatsApp at <a href="tel:+8801603438543" className="text-primary story-link">01603438543</a>.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
