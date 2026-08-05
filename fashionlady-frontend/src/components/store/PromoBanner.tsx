import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export const PromoBanner = () => (
  <section className="py-10 lg:py-28 bg-background">
    <div className="container">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left promo */}
        <div className="relative overflow-hidden bg-primary text-primary-foreground p-10 md:p-14 min-h-[420px] group">
          <Image
            src="/assets/promo-banner/promo-banner-1.jpg"
            alt="promo1"
            aria-hidden
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="absolute inset-0 h-full w-full object-cover opacity-30 transition-transform duration-1000 group-hover:scale-110"
          />
          <div className="relative z-10 max-w-sm space-y-5">
            <p className="text-xs tracking-[0.3em] uppercase text-primary-foreground/80">Limited Edition</p>
            <h3 className="font-serif text-4xl md:text-5xl font-medium leading-tight">
              Festive Edit '25
            </h3>
            <p className="opacity-85">
              Heritage embroidery meets contemporary silhouettes. Discover pieces made for celebration.
            </p>
            <Button
              asChild
              variant="outline"
              className="group/btn rounded-none border-primary-foreground text-primary hover:bg-accent hover:text-accent-foreground hover:border-accent"
            >
              <Link href="/shop">
                Shop the Edit
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Right promo */}
        <div className="relative overflow-hidden bg-accent-soft p-10 md:p-14 min-h-[420px] group">
          <Image
            src="/assets/promo-banner/promo-banner-2.jpg"
            alt="promo2"
            aria-hidden
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="absolute inset-0 h-full w-full object-cover opacity-40 transition-transform duration-1000 group-hover:scale-110"
          />
          <div className="relative z-10 max-w-sm space-y-5 text-primary">
            <p className="text-xs tracking-[0.3em] uppercase text-accent-foreground/80">Get Mesmerising Deals</p>
            <h3 className="font-serif text-4xl md:text-5xl font-medium leading-tight">
              Up to 30% Off Lawn
            </h3>
            <p className="opacity-85">
              Refresh your wardrobe with our season favourites — now at limited-time prices.
            </p>
            <Button asChild className="group/btn rounded-none bg-primary text-primary-foreground hover:bg-primary-glow">
              <Link href="/shop">
                Shop Sale
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
);
