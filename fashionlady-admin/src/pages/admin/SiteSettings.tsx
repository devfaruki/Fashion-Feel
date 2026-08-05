import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Copy, Facebook, Globe2, Image as ImageIcon, Mail, Phone, Save, Search, Sparkles, Upload } from "lucide-react";
import { api, resolveAssetUrl } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

interface SiteSettingsPayload {
  brandName: string;
  headerLogo: string;
  footerLogo: string;
  favicon: string;
  phone: string;
  email: string;
  showroomTitle: string;
  address: string;
  hours: string;
  aboutIntro: string;
  aboutStory: string;
  facebookUrl: string;
  instagramUrl: string;
  gtmId: string;
  ga4MeasurementId: string;
  microsoftClarityId: string;
  metaPixelId: string;
  metaPixelAccessToken: string;
  metaPixelTestCode: string;
  tiktokPixelId: string;
  tiktokPixelAccessToken: string;
  tiktokPixelTestCode: string;
}

function LogoPreview({ label, src }: { label: string; src?: string }) {
  return (
    <div className="rounded-xl border bg-secondary/40 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {src ? (
        <img src={resolveAssetUrl(src)} alt={label} className="h-16 max-w-full object-contain" />
      ) : (
        <div className="flex h-16 items-center justify-center text-sm text-muted-foreground">No image</div>
      )}
    </div>
  );
}

export default function SiteSettings() {
  const queryClient = useQueryClient();
  const shopOrigin = window.location.origin.replace(/\/admin.*$/, "");

  const settingsQuery = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await api.get("/site-settings");
      return data.data as SiteSettingsPayload;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: FormData) => {
      const { data } = await api.patch("/site-settings", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.data as SiteSettingsPayload;
    },
    onSuccess: async () => {
      toast({ title: "Site settings updated" });
      await queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Update failed",
        description: getErrorMessage(error) || "Failed to update site settings.",
        variant: "destructive",
      });
    },
  });

  const settings = settingsQuery.data;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await updateMutation.mutateAsync(new FormData(event.currentTarget));
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-[520px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="shadow-soft">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="font-display text-3xl">Manage Shop</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Marketing, SEO, feeds, tracking setup, logos, contact, and about page content.
            </p>
          </div>
          <Button type="submit" disabled={updateMutation.isPending} className="rounded-xl bg-gradient-primary text-primary-foreground">
            <Save className="mr-2 h-4 w-4" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </CardHeader>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-xl">Marketing & SEO Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { icon: Search, title: "Sitemaps for Search Engine", desc: "Add this sitemap to Google Search Console.", value: `${shopOrigin}/sitemap.xml` },
            { icon: Facebook, title: "Facebook Data Feed", desc: "Use this product feed for Meta catalog.", value: `${shopOrigin}/api/meta/catalog` },
            { icon: Globe2, title: "Product Catalog API", desc: "Catalog URL for external tools and integrations.", value: `${shopOrigin}/api/meta/catalog` },
          ].map(({ icon: Icon, title, desc, value }) => (
            <div key={title} className="rounded-xl border p-4">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 font-mono text-sm">
                <span className="flex-1 truncate">{value}</span>
                <Button type="button" size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(value)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="h-5 w-5" /> Brand Images
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <LogoPreview label="Current header logo" src={settings?.headerLogo} />
            <div className="space-y-2">
              <Label htmlFor="headerLogo">Header Logo</Label>
              <Input id="headerLogo" name="headerLogo" type="file" accept="image/*" />
            </div>

            <LogoPreview label="Current footer logo" src={settings?.footerLogo} />
            <div className="space-y-2">
              <Label htmlFor="footerLogo">Footer Logo</Label>
              <Input id="footerLogo" name="footerLogo" type="file" accept="image/*" />
            </div>

            <LogoPreview label="Current browser logo" src={settings?.favicon} />
            <div className="space-y-2">
              <Label htmlFor="favicon">Browser Logo / Favicon</Label>
              <Input id="favicon" name="favicon" type="file" accept="image/*" />
            </div>

            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              <Upload className="mb-2 h-4 w-4" />
              Leave image fields empty to keep current logos.
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe2 className="h-5 w-5" /> Store Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand Name</Label>
              <Input id="brandName" name="brandName" defaultValue={settings?.brandName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="showroomTitle">Showroom Title</Label>
              <Input id="showroomTitle" name="showroomTitle" defaultValue={settings?.showroomTitle} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> Number
              </Label>
              <Input id="phone" name="phone" defaultValue={settings?.phone} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Gmail Address
              </Label>
              <Input id="email" name="email" type="email" defaultValue={settings?.email} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Contact Address</Label>
              <Textarea id="address" name="address" defaultValue={settings?.address} rows={3} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="hours">Opening Hours</Label>
              <Input id="hours" name="hours" defaultValue={settings?.hours} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="aboutIntro">About Us Intro</Label>
              <Textarea id="aboutIntro" name="aboutIntro" defaultValue={settings?.aboutIntro} rows={3} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="aboutStory">About Us Story</Label>
              <Textarea id="aboutStory" name="aboutStory" defaultValue={settings?.aboutStory} rows={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebookUrl">Facebook URL</Label>
              <Input id="facebookUrl" name="facebookUrl" defaultValue={settings?.facebookUrl} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagramUrl">Instagram URL</Label>
              <Input id="instagramUrl" name="instagramUrl" defaultValue={settings?.instagramUrl} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-xl">Tracking Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Google & Microsoft</h3>
                <p className="text-sm text-muted-foreground">These IDs load on the storefront with env fallback.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gtmId">GTM ID</Label>
                <Input id="gtmId" name="gtmId" defaultValue={settings?.gtmId} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ga4MeasurementId">GA4 Measurement ID</Label>
                <Input id="ga4MeasurementId" name="ga4MeasurementId" defaultValue={settings?.ga4MeasurementId} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="microsoftClarityId">Microsoft Clarity Project ID</Label>
                <Input id="microsoftClarityId" name="microsoftClarityId" defaultValue={settings?.microsoftClarityId} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground">
                <Facebook className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Meta Pixel and Conversion API</h3>
                <p className="text-sm text-muted-foreground">Pixel ID is public; access token stays inside admin settings.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="metaPixelId">Pixel ID</Label>
                <Input id="metaPixelId" name="metaPixelId" defaultValue={settings?.metaPixelId} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaPixelAccessToken">Pixel Access Token</Label>
                <Input id="metaPixelAccessToken" name="metaPixelAccessToken" type="password" defaultValue={settings?.metaPixelAccessToken} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaPixelTestCode">Pixel Test Event Code</Label>
                <Input id="metaPixelTestCode" name="metaPixelTestCode" defaultValue={settings?.metaPixelTestCode} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">TikTok Pixel and Events API</h3>
                <p className="text-sm text-muted-foreground">Track storefront actions and server-side test events.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tiktokPixelId">TikTok Pixel ID</Label>
                <Input id="tiktokPixelId" name="tiktokPixelId" defaultValue={settings?.tiktokPixelId} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tiktokPixelAccessToken">TikTok Pixel Access Token</Label>
                <Input id="tiktokPixelAccessToken" name="tiktokPixelAccessToken" type="password" defaultValue={settings?.tiktokPixelAccessToken} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tiktokPixelTestCode">TikTok Pixel Test Event Code</Label>
                <Input id="tiktokPixelTestCode" name="tiktokPixelTestCode" defaultValue={settings?.tiktokPixelTestCode} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
