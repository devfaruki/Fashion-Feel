import { Truck, ShieldCheck, Headphones, RotateCcw } from "lucide-react";

const items = [
  { icon: Truck, title: "Free Shipping", desc: "On orders over BDT 5,000" },
  { icon: ShieldCheck, title: "Secure Payment", desc: "100% safe checkout" },
  { icon: Headphones, title: "24/7 Support", desc: "Dedicated to assist you" },
];

export const Features = () => (
  <section className="py-10 lg:py-16 bg-primary text-white">
    <div className="container grid grid-cols-1 lg:grid-cols-4 gap-8">
      {items.map((item, i) => (
        <div
          key={item.title}
          className="flex items-center gap-4 animate-fade-in-up"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="h-12 w-12 flex-shrink-0 rounded-full border border-white/50 flex items-center justify-center text-white">
            <item.icon className="h-5 w-5" />
          </div>
          <div className="text-white">
            <h4 className="font-serif text-lg font-medium text-white">{item.title}</h4>
            <p className="text-sm text-white/80">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
);
