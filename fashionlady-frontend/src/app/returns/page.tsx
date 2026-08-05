"use client";

import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { Camera, ShieldAlert, BadgePercent, AlertOctagon, PhoneCall } from "lucide-react";
import Link from "next/link";

export default function Returns() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <div>
        <Header />
        <main className="pb-24">
          {/* Hero Section */}
          <section className="bg-secondary/40 border-b border-border">
            <div className="container py-16 md:py-20 text-center max-w-4xl">
              <span className="text-xs tracking-[0.3em] uppercase text-accent font-semibold mb-3 block">
                FASHIONLADY POLICY
              </span>
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-primary mb-5 leading-tight">
                রিটার্ন ও এক্সচেঞ্জ পলিসি
              </h1>
              <p className="text-muted-foreground mt-4 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                ফ্যাশনলেডি-তে আপনার শপিং অভিজ্ঞতা আরও সুন্দর, নিরাপদ এবং স্বচ্ছ করার জন্য অনুগ্রহ করে আমাদের রিটার্ন ও এক্সচেঞ্জ সংক্রান্ত নীতিমালাটি দেখে নিন।
              </p>
            </div>
          </section>

          {/* Policy Cards Grid */}
          <section className="container max-w-5xl py-16 md:py-20">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Point 1 */}
              <div className="group border border-border bg-card/50 p-8 rounded-none transition-all duration-300 hover:border-primary/50 hover:bg-secondary/20 flex gap-6">
                <div className="h-12 w-12 rounded-none bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                  <Camera className="h-6 w-6 text-accent" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-serif text-xl text-primary font-medium">পণ্যের বিবরণ ও রঙ</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    সকল পণ্যের ছবি ও বিবরণ যথাসম্ভব সঠিকভাবে প্রদর্শনের চেষ্টা করা হয়। তবে আলো, ক্যামেরা বা ডিভাইসের ডিসপ্লের কারণে পণ্যের রঙে সামান্য পার্থক্য হতে পারে।
                  </p>
                </div>
              </div>

              {/* Point 2 */}
              <div className="group border border-border bg-card/50 p-8 rounded-none transition-all duration-300 hover:border-primary/50 hover:bg-secondary/20 flex gap-6">
                <div className="h-12 w-12 rounded-none bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                  <ShieldAlert className="h-6 w-6 text-accent" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-serif text-xl text-primary font-medium">পণ্য রিসিভ করার নিয়ম</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    পণ্য গ্রহণের সময় অবশ্যই ডেলিভারি পারসনের সামনে চেক করে নিতে হবে। আমাদের কোনো রিটার্ন / রিফান্ড / এক্সচেঞ্জ সিস্টেম নেই। ডেলিভারি পারসন আপনার বাসা / অফিস / ডেলিভারি ঠিকানা থেকে বের হয়ে যাওয়ার পর আপনার কোনো অভিযোগ গ্রহণযোগ্য হবে না।
                  </p>
                </div>
              </div>

              {/* Point 3 */}
              <div className="group border border-border bg-card/50 p-8 rounded-none transition-all duration-300 hover:border-primary/50 hover:bg-secondary/20 flex gap-6">
                <div className="h-12 w-12 rounded-none bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                  <BadgePercent className="h-6 w-6 text-accent" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-serif text-xl text-primary font-medium">ডেলিভারি চার্জ সংক্রান্ত নিয়ম</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    কুরিয়ার স্কোর এর উপর ভিত্তি করে বিশেষ ক্ষেত্রে অর্ডার কনফার্মেশন এর জন্য ডেলিভারি চার্জ এডভান্স নেয়া হতে পারে।
                  </p>
                </div>
              </div>

              {/* Point 4 */}
              <div className="group border border-border bg-card/50 p-8 rounded-none transition-all duration-300 hover:border-primary/50 hover:bg-secondary/20 flex gap-6">
                <div className="h-12 w-12 rounded-none bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                  <AlertOctagon className="h-6 w-6 text-accent" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-serif text-xl text-primary font-medium">অর্ডার বাতিলকরণ</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    কোনো প্রতারণামূলক কার্যক্রম বা ভুয়া অর্ডার শনাক্ত হলে ফ্যাশনলেডি কর্তৃপক্ষ সেই অর্ডার বাতিল করার পূর্ণ অধিকার রাখে।
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Bottom Call to Action */}
          <section className="container max-w-3xl text-center border-t border-border pt-12">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-secondary text-primary mb-4">
              <PhoneCall className="h-5 w-5" />
            </div>
            <p className="text-muted-foreground mb-4">কোনো প্রশ্ন বা জিজ্ঞাসার জন্য সরাসরি আমাদের যোগাযোগ করুন</p>
            <Link href="/contact" className="story-link text-primary font-medium hover:text-accent transition-colors duration-200">
              আমাদের সাথে যোগাযোগ করুন →
            </Link>
          </section>
        </main>
      </div>
      <Footer />
    </div>
  );
}
