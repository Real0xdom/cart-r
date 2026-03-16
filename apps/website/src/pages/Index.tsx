import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Truck, Smartphone, Shield, Clock, MapPin, DollarSign, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-logistics.jpg";
import truckIcon from "@/assets/truck-icon.png";
import trackingIcon from "@/assets/tracking-icon.png";
import trustIcon from "@/assets/trust-icon.png";

const Index = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const emailFormRef = useRef<HTMLFormElement>(null);

  const scrollToEmailForm = () => {
    emailFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("early_access_signups")
        .insert([{ email }]);

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Already registered!",
            description: "This email is already on our waitlist.",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "You're on the list!",
          description: "We'll notify you as soon as Cart-R launches.",
        });
        setEmail("");
      }
    } catch (error) {
      console.error("Error saving email:", error);
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--subtle-gradient)]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-[var(--shadow-sm)]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Cart-R</h1>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <img 
            src={heroImage} 
            alt="Logistics background" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-accent/10 border border-accent/20 rounded-full">
              <Rocket className="w-4 h-4 text-accent" />
              <p className="text-accent font-semibold text-sm">Coming Soon</p>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-foreground leading-tight">
              Cart-R: Rapid. Reliable. <span className="text-accent">Responsible.</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
              The next-generation logistics app designed to make transporting goods fast, simple, and affordable.
            </p>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Whether you need to book a truck, schedule a courier, or move bulky items across the city or across India, Cart-R connects you to a reliable fleet in just a few taps.
            </p>

            {/* Email Signup Form */}
            <form ref={emailFormRef} onSubmit={handleSubmit} className="max-w-md mx-auto mb-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                  required
                  disabled={isSubmitting}
                />
                <Button 
                  type="submit" 
                  variant="hero" 
                  size="lg" 
                  className="whitespace-nowrap"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Get Early Access"}
                </Button>
              </div>
            </form>
            <p className="text-sm text-muted-foreground">
              Join the waitlist for exclusive launch offers
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Logistics Made Simple
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage your transport needs in one powerful app
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Feature 1 */}
            <div className="bg-card rounded-2xl p-8 shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-all hover:-translate-y-1">
              <div className="w-16 h-16 mb-6 rounded-xl bg-accent/10 flex items-center justify-center">
                <img src={truckIcon} alt="Fleet" className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground">Flexible Fleet</h3>
              <p className="text-muted-foreground leading-relaxed">
                Choose from trucks, vans, bikes, and more. The perfect vehicle for every delivery need.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-card rounded-2xl p-8 shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-all hover:-translate-y-1">
              <div className="w-16 h-16 mb-6 rounded-xl bg-primary/10 flex items-center justify-center">
                <img src={trackingIcon} alt="Tracking" className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground">Real-Time Tracking</h3>
              <p className="text-muted-foreground leading-relaxed">
                Know exactly where your goods are at all times with live GPS tracking and updates.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-card rounded-2xl p-8 shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-all hover:-translate-y-1">
              <div className="w-16 h-16 mb-6 rounded-xl bg-primary/10 flex items-center justify-center">
                <img src={trustIcon} alt="Trust" className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground">Trusted Service</h3>
              <p className="text-muted-foreground leading-relaxed">
                All drivers are verified and rated. Your goods are in safe, reliable hands.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-card rounded-2xl p-8 shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-all hover:-translate-y-1">
              <div className="w-16 h-16 mb-6 rounded-xl bg-accent/10 flex items-center justify-center">
                <Clock className="w-10 h-10 text-accent" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground">Book in Seconds</h3>
              <p className="text-muted-foreground leading-relaxed">
                Instant bookings with just a few taps. No phone calls, no hassle, no delays.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-card rounded-2xl p-8 shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-all hover:-translate-y-1">
              <div className="w-16 h-16 mb-6 rounded-xl bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground">Transparent Pricing</h3>
              <p className="text-muted-foreground leading-relaxed">
                Get instant price estimates before you book. No hidden fees, no surprises.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-card rounded-2xl p-8 shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] transition-all hover:-translate-y-1">
              <div className="w-16 h-16 mb-6 rounded-xl bg-accent/10 flex items-center justify-center">
                <MapPin className="w-10 h-10 text-accent" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-foreground">Pune Coverage Soon</h3>
              <p className="text-muted-foreground leading-relaxed">
                Starting with comprehensive coverage across Pune. Expanding to more cities soon.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8 text-foreground">
            Reliable. Flexible. Transparent.
          </h2>
          <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
            With a sleek, intuitive mobile experience, instant price estimates, and trusted service providers, Cart-R puts total control of your logistics needs in your pocket.
          </p>
          <div className="bg-card rounded-2xl p-8 md:p-12 shadow-[var(--shadow-lg)]">
            <p className="text-2xl md:text-3xl font-semibold mb-6 text-foreground">
              The future of hassle-free delivery and moving is almost here.
            </p>
            <Button 
              variant="hero" 
              size="lg" 
              className="text-lg px-10 py-6 h-auto"
              onClick={scrollToEmailForm}
            >
              Reserve Your Spot
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <span className="font-bold text-lg text-foreground">Cart-R</span>
            <p className="text-muted-foreground text-center">
              © 2025 Cart-R. All rights reserved. Launching soon.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
