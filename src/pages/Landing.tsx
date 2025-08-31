import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  Calendar,
  Receipt,
  BarChart3,
  Shield,
  Clock,
  CheckCircle,
  ArrowRight,
  Star,
  Linkedin,
  Twitter,
  Facebook,
  Phone,
  Mail,
  MapPin,
  User,
  LogOut,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

export function Landing() {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);

  // Fetch profile when user changes
  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(data);
      };
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    setProfile(null);
    navigate("/");
  };

  const features = [
    {
      icon: Users,
      title: "Patient Management",
      description:
        "Comprehensive patient records with medical history, demographics, and contact information.",
    },
    {
      icon: Calendar,
      title: "Appointment Scheduling",
      description:
        "Efficient scheduling system with real-time updates and automated reminders.",
    },
    {
      icon: Receipt,
      title: "Billing & Payments",
      description:
        "Streamlined billing process with payment tracking and automated invoicing.",
    },
    {
      icon: BarChart3,
      title: "Analytics & Reports",
      description:
        "Detailed insights into clinic performance with comprehensive reporting tools.",
    },
    {
      icon: Shield,
      title: "Secure & Compliant",
      description:
        "HIPAA-compliant security with role-based access and data encryption.",
    },
    {
      icon: Clock,
      title: "Real-time Updates",
      description:
        "Live synchronization across all devices with instant notifications.",
    },
  ];

  const benefits = [
    "Reduce administrative overhead by 60%",
    "Improve patient satisfaction with streamlined processes",
    "Increase revenue with efficient billing management",
    "Ensure compliance with healthcare regulations",
    "Access your clinic data from anywhere, anytime",
  ];

  const carouselImages = [
    "/home_page_1.jpg",
    "/home_page_2.jpg",
    "/home_page_3.jpg",
    "/home_page_4.jpg",
  ];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [carouselImages.length]);

  const nextImage = () =>
    setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length);
  const prevImage = () =>
    setCurrentImageIndex((prev) =>
      prev === 0 ? carouselImages.length - 1 : prev - 1
    );

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold text-gray-900">
                  <Link to="/">
                    <img
                      src="/abhicure_logo_nobg.png"
                      alt="AbhiCure Logo"
                      className="h-14 w-auto object-contain"
                    />
                  </Link>
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {loading ? (
                <div className="animate-pulse flex space-x-4">
                  <div className="h-8 w-16 bg-gray-200 rounded"></div>
                  <div className="h-8 w-24 bg-gray-200 rounded"></div>
                </div>
              ) : user ? (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-gray-700">
                    <User className="h-5 w-5" />
                    <div className="text-sm">
                      <div className="font-medium">
                        {profile?.admin_name ||
                          profile?.name ||
                          "Welcome back!"}
                      </div>
                      {profile?.clinic_name && (
                        <div className="text-xs text-gray-500">
                          {profile.clinic_name}
                        </div>
                      )}
                    </div>
                  </div>
                  <Link to="/admin/dashboard">
                    <Button size="sm">
                      Go to Dashboard
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                  <Button size="sm" variant="outline" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <>
                  <Link
                    to="/auth"
                    className="text-gray-600 hover:text-gray-900 transition-colors duration-200"
                  >
                    Sign In
                  </Link>
                  <Link to="/auth">
                    <Button size="sm">
                      Get Started
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Carousel */}
      <section className="relative bg-gradient-to-br from-blue-50 via-white to-blue-50 pt-20 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <div className="text-center lg:text-left z-10">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Modern Clinic
              <span className="text-blue-600 block">Management System</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Streamline your healthcare practice with our comprehensive clinic
              management solution. Manage patients, schedule appointments,
              handle billing, and gain valuable insights - all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              {user ? (
                <Link to="/admin/dashboard">
                  <Button size="lg" className="w-full sm:w-auto">
                    Go to Dashboard
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              ) : (
                <Link to="/auth">
                  <Button size="lg" className="w-full sm:w-auto">
                    Start Free Trial
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              )}
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Watch Demo
              </Button>
            </div>
          </div>
          {/* Carousel */}
          <div className="relative h-64 sm:h-80 lg:h-[450px] shadow-2xl rounded-3xl">
            <div className="relative w-full h-full overflow-hidden rounded-3xl">
              <div
                className="flex transition-transform duration-700 ease-in-out h-full"
                style={{
                  transform: `translateX(-${currentImageIndex * 100}%)`,
                }}
              >
                {carouselImages.map((image, index) => (
                  <div key={index} className="w-full flex-shrink-0 h-full">
                    <img
                      src={image}
                      alt={`Healthcare scene ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* Navigation Arrows */}
            <button
              onClick={prevImage}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white text-blue-600 p-2 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
            >
              {/* Use ChevronLeft from lucide-react */}
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={nextImage}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white text-blue-600 p-2 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
            >
              {/* Use ChevronRight from lucide-react */}
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
            {/* Dots Indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
              {carouselImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentImageIndex
                      ? "bg-blue-600 w-6"
                      : "bg-white/60 hover:bg-white"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Run Your Clinic
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful features designed specifically for healthcare
              professionals to enhance efficiency and patient care.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow duration-300"
              >
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <feature.icon className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Transform Your Healthcare Practice
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Join thousands of healthcare professionals who have
                revolutionized their practice management with our intuitive and
                powerful platform.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                {user ? (
                  <Link to="/admin/dashboard">
                    <Button size="lg">
                      Go to Dashboard
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                  </Link>
                ) : (
                  <Link to="/auth">
                    <Button size="lg">
                      Get Started Today
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-8 text-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold mb-2">10K+</div>
                    <div className="text-blue-100">Happy Patients</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold mb-2">500+</div>
                    <div className="text-blue-100">Clinics</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold mb-2">99.9%</div>
                    <div className="text-blue-100">Uptime</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold mb-2">24/7</div>
                    <div className="text-blue-100">Support</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Trusted by Healthcare Professionals
            </h2>
            <p className="text-xl text-gray-600">
              See what our users have to say about their experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Dr. Sarah Johnson",
                role: "Family Medicine",
                content:
                  "ClinicAdmin has transformed how we manage our practice. The intuitive interface and powerful features have saved us countless hours.",
                rating: 5,
              },
              {
                name: "Dr. Michael Chen",
                role: "Pediatrician",
                content:
                  "The appointment scheduling and patient management features are exactly what we needed. Highly recommended for any clinic.",
                rating: 5,
              },
              {
                name: "Dr. Emily Rodriguez",
                role: "Dermatologist",
                content:
                  "Outstanding billing system and reporting capabilities. Our revenue tracking has never been more accurate and efficient.",
                rating: 5,
              },
            ].map((testimonial, index) => (
              <div
                key={index}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5 text-yellow-400 fill-current"
                    />
                  ))}
                </div>
                <p className="text-gray-700 mb-4 italic">
                  "{testimonial.content}"
                </p>
                <div>
                  <div className="font-semibold text-gray-900">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Practice?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of healthcare professionals who trust ClinicAdmin for
            their practice management needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Link to="/admin/dashboard">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white text-blue-600 hover:bg-gray-50 w-full sm:w-auto"
                >
                  Go to Dashboard
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white text-blue-600 hover:bg-gray-50 w-full sm:w-auto"
                >
                  Start Your Free Trial
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            )}
            <Button
              size="lg"
              variant="outline"
              className="border-white hover:bg-blue-700 w-full sm:w-auto"
            >
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1E2A38] text-white">
        <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* About */}
            <div className="col-span-1 md:col-span-2 lg:col-span-1">
              <img
                src="/abhicure_logo_nobg.png"
                alt="AbhiCure Logo"
                className="h-12 w-auto bg-white p-2 rounded-md mb-4"
              />
              <p className="text-gray-400">
                Empowering healthcare professionals and prioritizing patient
                well-being through technology.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-semibold text-lg mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a
                    href="#services"
                    className="hover:text-white transition-colors"
                  >
                    Services
                  </a>
                </li>
                <li>
                  <a
                    href="#doctors"
                    className="hover:text-white transition-colors"
                  >
                    Find a Doctor
                  </a>
                </li>
                <li>
                  <a
                    href="#appointment"
                    className="hover:text-white transition-colors"
                  >
                    Book Appointment
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    About Us
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="font-semibold text-lg mb-4">Contact Us</h4>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-start">
                  <MapPin className="w-5 h-5 mr-3 mt-1 flex-shrink-0" />
                  <span>
                    123 Healthcare Complex, Mumbai, Maharashtra 400001
                  </span>
                </li>
                <li className="flex items-center">
                  <Mail className="w-5 h-5 mr-3" />
                  <a
                    href="mailto:support@abhicure.com"
                    className="hover:text-white"
                  >
                    support@abhicure.com
                  </a>
                </li>
                <li className="flex items-center">
                  <Phone className="w-5 h-5 mr-3" />
                  <a href="tel:+919876543210" className="hover:text-white">
                    +91 98765 43210
                  </a>
                </li>
                <li className="flex items-center">
                  <Clock className="w-5 h-5 mr-3" />
                  <span>Mon - Sat: 9 AM - 8 PM</span>
                </li>
              </ul>
            </div>

            {/* Social */}
            <div>
              <h4 className="font-semibold text-lg mb-4">Follow Us</h4>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white">
                  <Facebook size={24} />
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <Twitter size={24} />
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <Linkedin size={24} />
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-12 pt-8 text-center text-gray-500">
            <p>
              &copy; {new Date().getFullYear()} AbhiCure. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
