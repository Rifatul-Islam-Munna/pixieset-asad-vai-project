import {
  ChevronDown,
  Download,
  ShoppingCart,
  User,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const galleryTabs = [
  {
    value: "share",
    label: "Share photos",
    image:
      "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=900&q=80",
    title: "Client Gallery",
  },
  {
    value: "delivery",
    label: "Digital delivery",
    image:
      "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=900&q=80",
    title: "Download Delivery",
  },
  {
    value: "proofing",
    label: "Online proofing",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    title: "Proofing Gallery",
  },
  {
    value: "sell",
    label: "Sell photos",
    image:
      "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=900&q=80",
    title: "Print Store",
  },
];

const products = [
  {
    title: "Canvas",
    price: "From $130.00",
    image:
      "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=500&q=80",
  },
  {
    title: "Metal Print",
    price: "From $66.00",
    image:
      "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=500&q=80",
  },
  {
    title: "Standout",
    price: "From $50.00",
    image:
      "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=500&q=80",
  },
];

const workflowTabs = [
  {
    value: "wedding",
    label: "Wedding",
    image:
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1300&q=80",
  },
  {
    value: "portrait",
    label: "Portrait",
    image:
      "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?auto=format&fit=crop&w=1300&q=80",
  },
  {
    value: "family",
    label: "Family",
    image:
      "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1300&q=80",
  },
  {
    value: "seniors",
    label: "Seniors",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1300&q=80",
  },
  {
    value: "events",
    label: "Events",
    image:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1300&q=80",
  },
  {
    value: "adventure",
    label: "Adventure",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1300&q=80",
  },
  {
    value: "commercial",
    label: "Commercial",
    image:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1300&q=80",
  },
  {
    value: "sports",
    label: "Sports",
    image:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1300&q=80",
  },
];

const testimonials = [
  {
    name: "Reem Photography",
    site: "dreemteamweddings.com",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
    quote:
      "The four main Pixieset tools we currently use - gallery delivery, email templates, print store, and website domain - are essential in providing a seamless and professional experience for our clients.",
  },
  {
    name: "Bek Rogers",
    site: "bekrogersphoto.com",
    image:
      "https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?auto=format&fit=crop&w=120&q=80",
    quote:
      "Working with Pixieset has truly revolutionized my photography business. Pixieset has given me the ease of delivering galleries through the same platform that houses my website.",
  },
  {
    name: "Chris Joubert",
    site: "chrisjoubert.com",
    image:
      "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=120&q=80",
    quote:
      "Over the years I have used more and more of Pixieset's features. I started with client galleries, then created my website on it, then the print store, and now invoices and documents are on it too.",
  },
  {
    name: "Timi Oshin",
    site: "timioshin.com",
    image:
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=120&q=80",
    quote:
      "To be able to have all of these tools readily available by one platform is something that has changed how I run my photography business.",
  },
  {
    name: "Jessica Samyn",
    site: "jessicasamynphotographie.com",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
    quote:
      "Pixieset has changed my life in so many ways as a photographer. It is so simple and clean while still giving clients a beautiful experience.",
  },
  {
    name: "Kendall Aubrey",
    site: "kendallaubrey.com",
    image:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80",
    quote:
      "Pixieset was one of the first investments I made for my business. It keeps my client work polished, organized, and easy to share.",
  },
];

const footerColumns = [
  {
    title: "Products",
    links: [
      "Client Gallery",
      "Website",
      "Studio Manager",
      "Store",
      "Mobile Gallery App",
      "Photo Editor",
      "Examples",
      "Pricing",
    ],
  },
  {
    title: "Resources",
    links: ["Help & Support", "Pixieset Blog", "Apps & Plugins", "Service Status"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Terms Of Service", "Privacy Policy"],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative min-h-[830px] overflow-hidden text-white">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=2400&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_53%_44%,rgba(255,255,255,0.25),transparent_24%),linear-gradient(90deg,rgba(0,0,0,0.62),rgba(0,0,0,0.18)_55%,rgba(0,0,0,0.5))]" />

        <header className="relative z-10 flex h-14 items-center justify-between px-7 lg:px-8">
          <a
            href="#"
            className="font-serif text-2xl tracking-[0.36em] text-white"
            aria-label="Pixieset"
          >
            PIXIESET
          </a>

          <nav className="hidden items-center gap-8 text-sm font-semibold md:flex">
            <a href="#" className="inline-flex items-center gap-1">
              Products <ChevronDown data-icon="inline-end" />
            </a>
            <a href="#">Examples</a>
            <a href="#">Pricing</a>
          </nav>

          <div className="flex items-center gap-6">
            <a href="#" className="hidden text-sm font-semibold md:inline">
              Log In
            </a>
            <Button
              asChild
              className="h-11 min-w-40 rounded-none bg-[#22bda7] text-sm font-bold text-white hover:bg-[#19a995]"
            >
              <a href="#">Get Started</a>
            </Button>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[720px] w-full max-w-[1240px] items-center px-7 pt-8 lg:px-8">
          <div className="max-w-[760px] pt-16">
            <p className="mb-7 text-sm font-bold tracking-wide">
              PIXIESET PHOTOGRAPHER PLATFORM
            </p>
            <h1 className="max-w-[760px] text-5xl font-semibold leading-[1.28] tracking-normal md:text-[52px]">
              Designed for photographers.
              <br />
              Built to help you grow.
            </h1>
            <p className="mt-6 max-w-[760px] text-lg font-semibold leading-7 text-white/90">
              Industry-leading photo galleries, website and business tools to
              streamline your workflow and grow your photography business.
            </p>
            <Button
              asChild
              className="mt-8 h-11 min-w-40 rounded-none bg-[#22bda7] text-base font-bold text-white hover:bg-[#19a995]"
            >
              <a href="#">Get Started</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t bg-white pb-20 pt-8">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center px-6 text-center">
          <h2 className="max-w-[700px] text-[40px] font-semibold leading-[1.2] tracking-normal text-[#202020]">
            The ultimate photo gallery that
            <br />
            redefined the industry.
          </h2>
          <p className="mt-7 max-w-[730px] text-lg leading-7 text-[#666]">
            Trusted by more than a million photographers today, Client Gallery
            turns every photo delivery into an unforgettable brand moment.
          </p>

          <Tabs defaultValue="sell" className="mt-12 w-full items-center gap-0">
            <TabsList
              className="flex h-auto w-full flex-wrap gap-2 bg-transparent p-0"
            >
              {galleryTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="h-11 min-w-[144px] rounded-full bg-[#fafafa] px-6 text-sm font-normal text-[#344054] data-active:bg-[#22bda7] data-active:text-white"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {galleryTabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="w-full">
                <div className="relative mt-12 h-[500px] w-full overflow-hidden bg-[#eef4f3] shadow-[0_18px_45px_rgba(0,0,0,0.09)] md:h-[560px]">
                  <div className="absolute left-[17%] top-12 hidden h-[470px] w-[22%] bg-[#aeb2a5] md:block">
                    <img
                      src={tab.image}
                      alt={tab.label}
                      className="absolute bottom-0 left-1/2 h-[325px] w-[76%] -translate-x-1/2 object-cover"
                    />
                  </div>

                  <div className="absolute left-1/2 top-12 h-[430px] w-[82%] -translate-x-1/2 bg-white p-4 text-left shadow-[0_8px_28px_rgba(0,0,0,0.08)] md:left-[39%] md:top-[66px] md:h-[510px] md:w-[43%] md:translate-x-0 md:p-8">
                    <h3 className="text-base font-semibold text-[#222]">
                      {tab.title}
                    </h3>
                    <div className="mt-7 flex flex-wrap gap-4 text-[11px] font-semibold tracking-wide text-[#8a8a8a] md:gap-7">
                      <span>PRINTS</span>
                      <span className="border-b border-[#222] pb-3 text-[#222]">
                        WALL ART
                      </span>
                      <span>CARDS</span>
                      <span>ALBUMS & BOOKS</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 md:gap-5">
                      {products.map((product) => (
                        <div key={product.title}>
                          <div className="flex h-24 items-center justify-center bg-[#f7f7f7] md:h-36">
                            <img
                              src={tab.image}
                              alt={product.title}
                              className="h-16 w-14 object-cover shadow-md md:h-24 md:w-20"
                            />
                          </div>
                          <p className="mt-3 text-sm font-medium text-[#333]">
                            {product.title}
                          </p>
                          <p className="mt-1 text-sm text-[#777]">
                            {product.price}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="absolute right-[13%] top-[66px] hidden h-16 w-[230px] items-center gap-4 bg-white px-6 text-left shadow-[0_5px_15px_rgba(0,0,0,0.15)] md:flex">
                    <div className="relative">
                      <ShoppingCart />
                      <span className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-[#22bda7] text-[9px] font-bold text-white">
                        15
                      </span>
                    </div>
                    <span className="text-2xl font-normal text-[#222]">
                      Shopping Cart
                    </span>
                  </div>

                  <div className="absolute bottom-[-20px] right-[12%] hidden h-[245px] w-[178px] overflow-hidden rounded-[18px] bg-white shadow-[0_8px_28px_rgba(0,0,0,0.16)] sm:block">
                    <div className="flex h-9 items-center justify-between px-3 text-[#888]">
                      <span className="text-lg">&lt;</span>
                      <span className="text-[8px] text-[#222]">Print Store</span>
                      <span className="flex gap-2">
                        <ShoppingCart />
                        <User />
                      </span>
                    </div>
                    <div className="relative h-[206px]">
                      <img
                        src={tab.image}
                        alt={`${tab.label} mobile store`}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Download className="text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      <section className="border-t bg-white px-6 py-20 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <div className="mx-auto max-w-[780px] text-center">
            <p className="text-sm font-bold tracking-[0.18em] text-[#008f7f]">
              DESIGNED FOR EVERY WORKFLOW
            </p>
            <h2 className="mt-8 text-4xl font-semibold leading-[1.18] tracking-normal text-[#202020] md:text-[40px]">
              Made for all photographers.
            </h2>
            <p className="mt-6 text-lg leading-7 text-[#666]">
              From weddings to landscapes and everything in between, Pixieset is
              built to elevate your business - and make your work look its best.
            </p>
          </div>

          <Tabs
            defaultValue="events"
            className="mt-16 grid items-center gap-10 lg:grid-cols-[1fr_320px] lg:gap-24"
          >
            <div className="w-full">
              {workflowTabs.map((tab) => (
                <TabsContent
                  key={tab.value}
                  value={tab.value}
                  className="mt-0"
                >
                  <div className="relative mx-auto min-h-[520px] w-full max-w-[770px] overflow-hidden bg-[#ddecf5] md:min-h-[575px]">
                    <img
                      src={tab.image}
                      alt={`${tab.label} photography booking page`}
                      className="absolute inset-0 h-full w-full object-cover opacity-65"
                    />
                    <div className="absolute left-1/2 top-10 w-[60%] min-w-[300px] -translate-x-1/2 overflow-hidden rounded-md bg-white shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
                      <div className="h-36 bg-[#1d1d1d]">
                        <img
                          src={tab.image}
                          alt={`${tab.label} hero`}
                          className="h-full w-full object-cover opacity-80"
                        />
                      </div>
                      <div className="p-6">
                        <h3 className="text-sm font-semibold text-[#222]">
                          {tab.label}
                        </h3>
                        <p className="mt-4 text-xs leading-5 text-[#555]">
                          Booking, payment, and client details in one polished
                          flow.
                        </p>
                      </div>
                      <div className="border-t p-6">
                        <div className="grid grid-cols-[1fr_1.3fr] gap-8">
                          <div>
                            <p className="text-xs font-semibold text-[#222]">
                              March 2025
                            </p>
                            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[10px] text-[#777]">
                              {Array.from({ length: 35 }).map((_, index) => (
                                <span
                                  key={index}
                                  className={
                                    index === 17
                                      ? "flex aspect-square items-center justify-center bg-[#222] text-white"
                                      : "flex aspect-square items-center justify-center bg-[#f6f6f6]"
                                  }
                                >
                                  {index + 1 <= 31 ? index + 1 : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#222]">
                              Thursday, March 13, 2025
                            </p>
                            <div className="mt-4 grid grid-cols-3 gap-2 text-[9px] text-[#555]">
                              {[
                                "09:00 AM",
                                "09:30 AM",
                                "10:00 AM",
                                "10:30 AM",
                                "11:00 AM",
                                "11:30 AM",
                                "12:00 PM",
                                "12:30 PM",
                                "01:00 PM",
                                "01:30 PM",
                                "02:00 PM",
                                "02:30 PM",
                              ].map((time) => (
                                <span
                                  key={time}
                                  className={
                                    time === "11:30 AM"
                                      ? "bg-[#222] px-2 py-3 text-center text-white"
                                      : "bg-[#f8f8f8] px-2 py-3 text-center"
                                  }
                                >
                                  {time}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </div>

            <TabsList
              className="mx-auto grid h-auto w-full max-w-[320px] grid-cols-2 gap-x-8 gap-y-6 bg-transparent p-0 text-left lg:grid-cols-1"
            >
              {workflowTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="h-auto justify-start rounded-none p-0 text-2xl font-semibold text-[#adadad] data-active:bg-transparent data-active:text-[#202020] data-active:underline data-active:decoration-2 data-active:underline-offset-4 sm:text-3xl"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </section>

      <section className="bg-[#f7f7f7] px-6 py-20 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <div className="mx-auto max-w-[780px] text-center">
            <p className="text-sm font-bold tracking-[0.18em] text-[#008f7f]">
              TRUSTED BY PROFESSIONALS
            </p>
            <h2 className="mt-8 text-4xl font-semibold leading-[1.18] tracking-normal text-[#202020] md:text-[40px]">
              "Truly the go-to photographer platform"
            </h2>
            <p className="mt-6 text-lg leading-7 text-[#666]">
              Become part of a growing community of photographers, artists,
              entrepreneurs, creators, makers and movers - you're in good
              company here.
            </p>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((item) => (
              <Card
                key={item.name}
                className="rounded-none border-0 py-0 shadow-none"
              >
                <CardHeader className="px-10 pt-10">
                  <div className="flex items-center gap-4">
                    <Avatar className="size-14">
                      <AvatarImage src={item.image} alt={item.name} />
                      <AvatarFallback>{item.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base font-bold text-black">
                        {item.name}
                      </CardTitle>
                      <CardDescription className="mt-1 text-sm text-[#9b9b9b]">
                        {item.site}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-10 pb-10 pt-7">
                  <p className="text-lg leading-7 text-black">"{item.quote}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-white px-6 pt-12 text-center">
        <div className="mx-auto max-w-[1240px]">
          <h2 className="text-4xl font-semibold leading-[1.16] tracking-normal text-[#202020] md:text-[40px]">
            Start using Pixieset today for free
          </h2>
          <p className="mt-7 text-lg text-[#666]">
            Free forever. Upgrade when you need to.
          </p>
          <Button
            asChild
            className="mt-9 h-11 min-w-40 rounded-none bg-[#22bda7] text-sm font-bold text-white hover:bg-[#19a995]"
          >
            <a href="#">Get Started</a>
          </Button>

          <div className="relative mx-auto mt-14 min-h-[470px] max-w-[1000px] md:min-h-[540px]">
            <div className="absolute left-1/2 top-0 h-[430px] w-[78%] -translate-x-1/2 overflow-hidden rounded-md border-[6px] border-white bg-[#ddd] shadow-[0_20px_55px_rgba(0,0,0,0.18)] md:h-[520px]">
              <img
                src="https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1500&q=80"
                alt="Photography website preview"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/10" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 text-white">
                <p className="text-3xl tracking-[0.18em] md:text-5xl">
                  MORGAN WELLS
                </p>
                <p className="mt-4 text-xs tracking-[0.35em]">
                  MODERN PORTRAIT PHOTOGRAPHY
                </p>
              </div>
            </div>

            <div className="absolute bottom-[-70px] left-0 hidden h-[360px] w-[205px] overflow-hidden rounded-[28px] border-[6px] border-white bg-white text-left shadow-[0_20px_45px_rgba(0,0,0,0.16)] sm:block">
              <div className="h-[190px] bg-[#222]">
                <img
                  src="https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=500&q=80"
                  alt="Mobile invoice"
                  className="h-full w-full object-cover opacity-85"
                />
              </div>
              <div className="p-5">
                <p className="text-sm font-bold text-[#222]">Invoice #1104</p>
                <p className="mt-5 text-xs leading-5 text-[#555]">
                  Download PDF
                  <br />
                  Due date
                  <br />
                  February 21, 2025
                </p>
              </div>
            </div>

            <div className="absolute bottom-[-55px] right-0 h-[300px] w-[280px] overflow-hidden rounded-[28px] border-[6px] border-white bg-white text-left shadow-[0_20px_45px_rgba(0,0,0,0.16)] sm:w-[410px]">
              <div className="relative h-[175px] bg-[#222]">
                <img
                  src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80"
                  alt="Client gallery preview"
                  className="h-full w-full object-cover opacity-85"
                />
                <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-lg font-bold text-white">
                  ISLA BENNETT
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 p-4">
                {[
                  "https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?auto=format&fit=crop&w=240&q=80",
                  "https://images.unsplash.com/photo-1524503033411-c9566986fc8f?auto=format&fit=crop&w=240&q=80",
                  "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?auto=format&fit=crop&w=240&q=80",
                ].map((image) => (
                  <img
                    key={image}
                    src={image}
                    alt="Gallery thumbnail"
                    className="aspect-[4/5] w-full object-cover"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#171918] px-6 py-20 text-white">
        <div className="mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-[1.5fr_2fr]">
          <div className="flex min-h-[360px] flex-col">
            <a
              href="#"
              className="font-serif text-2xl tracking-[0.36em] text-white"
              aria-label="Pixieset"
            >
              PIXIESET
            </a>
            <p className="mt-10 max-w-[470px] text-sm leading-6 text-white/80">
              An all-in-one platform for modern photographers, offering client
              photo galleries, websites, online stores and studio management
              software tools.
            </p>

            <div className="mt-16 flex items-center gap-7 text-white/75">
              <a href="#" aria-label="Instagram">
                <span className="text-sm font-semibold">IG</span>
              </a>
              <a href="#" aria-label="X">
                <span className="text-sm font-semibold">X</span>
              </a>
              <a href="#" aria-label="LinkedIn">
                <span className="text-sm font-semibold">in</span>
              </a>
              <a href="#" aria-label="Facebook">
                <span className="text-sm font-semibold">f</span>
              </a>
              <a href="#" aria-label="Threads">
                <span className="text-sm font-semibold">@</span>
              </a>
              <a href="#" aria-label="TikTok">
                <span className="text-sm font-semibold">TT</span>
              </a>
            </div>

            <p className="mt-auto pt-16 text-xs font-semibold text-white/80">
              &copy; 2026 Pixieset. Made with love in Vancity.
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h3 className="text-sm font-bold text-white">{column.title}</h3>
                <ul className="mt-5 flex flex-col gap-5 text-sm text-white/80">
                  {column.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="hover:text-white">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
