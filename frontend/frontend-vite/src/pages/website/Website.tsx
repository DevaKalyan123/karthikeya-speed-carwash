import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Car, Sparkles, Droplets, ShieldCheck, Clock, Phone, MapPin, Menu, X, ChevronLeft, ChevronRight, ChevronDown, LogIn, Navigation, Pause, Play } from "lucide-react";
import { ServiceAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import type { Service } from "../../types";
import logo from "../../assets/logo.png";
import heroWash from "../../assets/website/hero.webp";
import exterior from "../../assets/website/exterior.webp";
import interior from "../../assets/website/interior.webp";
import hatchback from "../../assets/website/hatchback.webp";
import sedan from "../../assets/website/sedan.webp";
import suv from "../../assets/website/suv.webp";
import detailing from "../../assets/shop/detailing.webp";
import entrance from "../../assets/shop/shop-entrance.webp";
import shopSign from "../../assets/shop/shop-sign.webp";
import washBay from "../../assets/shop/wash-bay.webp";
import "./Website.css";

const shop = "Karthikeya Speed Car Wash & Detail";
const address = "59-12-12/1, Pinnamaneni, Polyclinic Rd, Gayatri Nagar, Krishna Nagar, Vijayawada, Andhra Pradesh 520008";
const mapQuery = encodeURIComponent("Karthikeya Speed Car Wash, " + address);
const directions = "https://www.google.com/maps/dir/?api=1&destination=" + mapQuery;
const tel = "tel:+919267923927";
const nav = [{ name: "Home", href: "#home" }, { name: "Services", href: "#services" }, { name: "About Us", href: "#about" }, { name: "Gallery", href: "#gallery" }, { name: "Contact", href: "#contact" }];
const heroSlides = [
  { image: heroWash, title: "PREMIUM CAR WASH", accent: "& DETAILING", text: "Give your car the care, cleanliness and shine it deserves." },
  { image: exterior, title: "A FRESH FINISH", accent: "EVERY DRIVE", text: "Refresh your vehicle's appearance with professional exterior care." },
  { image: interior, title: "CLEAN INSIDE", accent: "& OUT", text: "Enjoy a fresher, more comfortable drive with our car care services." },
];
const vehicles = [
  { name: "Hatchback", image: hatchback, text: "Complete care for your everyday drive." },
  { name: "Sedan", image: sedan, text: "A clean finish for a comfortable journey." },
  { name: "SUV / MUV", image: suv, text: "Professional care for your larger vehicle." },
];
const gallery = [{ image: entrance, name: "Our service centre" }, { image: washBay, name: "Car wash area" }, { image: detailing, name: "Detailing in progress" }, { image: shopSign, name: "Find our workshop" }];
const price = (n: string | number) => Number(n).toLocaleString("en-IN", { style: "currency", currency: "INR" });
const servicePhoto = (name: string) => /interior|seat|upholstery|dashboard|vacuum|cabin/i.test(name) ? interior : /wash|wheel|tyre|rim|foam/i.test(name) ? heroWash : exterior;

function useCarousel(length: number, interval: number) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (paused || hover || focused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % length), interval);
    return () => window.clearInterval(timer);
  }, [paused, hover, focused, length, interval]);
  const move = (n: number) => setIndex(i => (i + n + length) % length);
  return { index, setIndex, move, paused, setPaused, setHover, setFocused };
}

function Heading({ label, children }: { label: string; children: string }) {
  return <div className="ks-heading" data-reveal><span>{label}</span><h2>{children}</h2><div className="ks-heading-line" /></div>;
}

export default function Website() {
  const { user } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceError, setServiceError] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const closePreview = useRef<HTMLButtonElement>(null);
  const lastPhoto = useRef<HTMLButtonElement | null>(null);
  const hero = useCarousel(heroSlides.length, 6500);
  const vehicle = useCarousel(vehicles.length, 5000);
  const dashboardPath = user ? "/" + user.role : "/login";
  const bookPath = !user ? "/login" : user.role === "admin" ? "/admin/requests" : "/" + user.role + "/book";

  useEffect(() => {
    let active = true;
    ServiceAPI.getAll().then(({ data }) => {
      if (active) setServices(Array.isArray(data.data) ? data.data : []);
    }).catch(() => { if (active) setServiceError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add("ks-in-view");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12 });
    el.querySelectorAll("[data-reveal]:not(.ks-in-view)").forEach(node => {
      node.classList.add("ks-reveal-ready");
      observer.observe(node);
    });
    return () => observer.disconnect();
  }, [services]);

  useEffect(() => {
    if (preview === null) return;
    closePreview.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setPreview(null); lastPhoto.current?.focus(); }
      if (event.key === "ArrowRight") setPreview(i => i === null ? null : (i + 1) % gallery.length);
      if (event.key === "ArrowLeft") setPreview(i => i === null ? null : (i - 1 + gallery.length) % gallery.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);
  const closeGallery = () => { setPreview(null); lastPhoto.current?.focus(); };

  return <div className="ks-website" ref={root}>
    <section id="home" className="ks-hero" onFocus={() => hero.setFocused(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) hero.setFocused(false); }}>
      <div className="ks-hero-images" aria-hidden="true">{heroSlides.map((slide, i) => <div key={slide.title} className={"ks-hero-slide " + (hero.index === i ? "active" : "")} style={{ backgroundImage: "url(" + slide.image + ")" }} />)}</div>
      <div className="ks-overlay" />
      <header className="ks-header">
        <a href="#home" className="ks-logo"><img src={logo} alt={shop} /></a>
        <button type="button" className="ks-menu-button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X /> : <Menu />}</button>
        <nav className={"ks-navigation " + (menuOpen ? "open" : "")}>{nav.map(item => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.name}</a>)}<Link to={dashboardPath} className="ks-btn" onClick={() => setMenuOpen(false)}><LogIn size={18} />{user ? "Dashboard" : "Login"}</Link></nav>
      </header>
      <div className="ks-hero-content">
        <div className="ks-hero-copy" key={hero.index}>
          <p className="ks-eyebrow">PROFESSIONAL VEHICLE CARE IN VIJAYAWADA</p>
          <h1>{heroSlides[hero.index].title}<span>{heroSlides[hero.index].accent}</span></h1>
          <p>{heroSlides[hero.index].text} Experience professional car washing and detailing at Karthikeya Speed Car Wash.</p>
        </div>
        <div className="ks-buttons"><Link to={bookPath} className="ks-btn">Book Your Wash</Link><a href="#services" className="ks-btn-outline">Explore Services</a></div>
      </div>
      <div className="ks-hero-controls">
        <button aria-label="Previous banner" onClick={() => hero.move(-1)}><ChevronLeft /></button>
        {heroSlides.map((slide, i) => <button key={slide.title} className={"ks-dot " + (i === hero.index ? "active" : "")} aria-label={"Show banner " + (i + 1)} aria-pressed={i === hero.index} onClick={() => hero.setIndex(i)} />)}
        <button aria-label={hero.paused ? "Play slideshow" : "Pause slideshow"} onClick={() => hero.setPaused(v => !v)}>{hero.paused ? <Play size={16} /> : <Pause size={16} />}</button><button aria-label="Next banner" onClick={() => hero.move(1)}><ChevronRight /></button>
      </div>
      <a className="ks-hero-phone" href={tel}><Phone size={18} /> +91 92679 23927</a>
      <a className="ks-scroll" href="#about" aria-label="Scroll to about"><ChevronDown /></a>
    </section>

    <section id="about" className="ks-section">
      <Heading label="WELCOME TO KARTHIKEYA">QUALITY, CONVENIENCE AND CARE</Heading>
      <div className="ks-about-grid"><p data-reveal="left">At {shop}, we provide professional cleaning and detailing services for your vehicle. Our focus is on quality service and a fresh, clean driving experience.</p><p data-reveal="right">Whether you need an exterior wash, interior cleaning or complete detailing, our service centre in Vijayawada is here to help. Book your preferred services online and manage your bookings with ease.</p></div>
      <div className="ks-centre" data-reveal><a href="#contact" className="ks-btn">Visit Our Service Centre</a></div>
      <div className="ks-benefits" data-reveal>{[{ icon: Droplets, label: "Exterior wash" }, { icon: Sparkles, label: "Detailing options" }, { icon: ShieldCheck, label: "Professional care" }].map(({ icon: Icon, label }) => <div key={label}><Icon size={26} /><span>{label}</span></div>)}</div>
    </section>

    <section className="ks-section ks-light" aria-label="Vehicle carousel">
      <Heading label="CARE FOR EVERY VEHICLE">CHOOSE YOUR VEHICLE</Heading>
      <div className="ks-carousel" data-reveal onMouseEnter={() => vehicle.setHover(true)} onMouseLeave={() => vehicle.setHover(false)} onFocus={() => vehicle.setFocused(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) vehicle.setFocused(false); }}>
        <button className="ks-carousel-button" aria-label="Previous vehicle" onClick={() => vehicle.move(-1)}><ChevronLeft /></button>
        <div className="ks-vehicle-window"><div className="ks-vehicle-track" style={{ transform: "translateX(-" + vehicle.index * 100 + "%)" }}>
          {vehicles.map((v, i) => <article className="ks-vehicle-card" key={v.name} aria-hidden={i !== vehicle.index}>
            <h3>{v.name}</h3><img src={v.image} alt={v.name + " vehicle illustration"} loading="lazy" /><p>{v.text}</p>
            <div className="ks-vehicle-features"><span><Droplets /> Exterior cleaning</span><span><Sparkles /> Detailing options</span><span><Car /> Interior care</span><span><ShieldCheck /> Professional service</span></div>
            <a href="#services" tabIndex={i === vehicle.index ? 0 : -1} className="ks-btn">View Service Prices</a>
          </article>)}
        </div></div>
        <button className="ks-carousel-button" aria-label="Next vehicle" onClick={() => vehicle.move(1)}><ChevronRight /></button>
        <div className="ks-vehicle-controls">{vehicles.map((v, i) => <button className={"ks-dot " + (i === vehicle.index ? "active" : "")} key={v.name} aria-label={"Show " + v.name} aria-pressed={i === vehicle.index} onClick={() => vehicle.setIndex(i)} />)}<button className="ks-pause" aria-label={vehicle.paused ? "Play carousel" : "Pause carousel"} onClick={() => vehicle.setPaused(v => !v)}>{vehicle.paused ? <Play size={17} /> : <Pause size={17} />}</button></div>
      </div>
    </section>

    <section className="ks-section ks-feature-section">
      <div className="ks-feature">
        <div className="ks-feature-image" data-reveal="left"><img src={exterior} alt="Illustrative photograph of professional exterior polishing" loading="lazy" /></div>
        <div className="ks-feature-content" data-reveal="right"><Droplets size={48} /><h2>EXTERIOR CARE</h2><div className="ks-heading-line" /><p>Keep your vehicle looking clean and well maintained. Our exterior cleaning and detailing services help remove everyday dirt and bring back a fresh finish.</p><Link to={bookPath} className="ks-btn">Book a Service</Link></div>
      </div>
      <div className="ks-feature reverse">
        <div className="ks-feature-image" data-reveal="right"><img src={interior} alt="Illustrative photograph of a clean modern car interior" loading="lazy" /></div>
        <div className="ks-feature-content" data-reveal="left"><Sparkles size={48} /><h2>INSIDE AND OUT</h2><div className="ks-heading-line" /><p>Enjoy a cleaner, fresher vehicle interior. Explore our cleaning and detailing services to maintain the appearance and comfort of your car.</p><Link to={bookPath} className="ks-btn">Choose Services</Link></div>
      </div>
    </section>

    <section id="services" className="ks-section ks-light">
      <Heading label="PROFESSIONAL CAR CARE">OUR SERVICES & PRICING</Heading>
      <p className="ks-centre ks-muted">Choose the services that suit your vehicle. Prices are shown in Indian rupees.</p>
      {loading && <p className="ks-centre">Loading services...</p>}
      {!loading && (serviceError || !services.length) && <p className="ks-centre">Please call us for current services and prices. <a href={tel}>092679 23927</a></p>}
      <div className="ks-service-grid">{services.map((s, i) => <article className="ks-service-card" data-reveal key={s.id} style={{ transitionDelay: Math.min(i % 3, 2) * 80 + "ms" }}><img src={servicePhoto(s.service_name)} alt="" loading="lazy" /><div className="ks-service-body"><h3>{s.service_name}</h3><p>{s.description || "Professional care for your vehicle."}</p><strong>{s.price == null ? "Contact for price" : "From " + price(s.price)}</strong><Link to={bookPath}>Book Service</Link></div></article>)}</div>
    </section>

    <section className="ks-book-banner" style={{ backgroundImage: "url(" + heroWash + ")" }}><div className="ks-overlay" /><div className="ks-book-content" data-reveal><h2>READY FOR A FRESH SHINE?</h2><p>Book your car wash today at Karthikeya Speed Car Wash.</p><Link to={bookPath} className="ks-btn">Book Now</Link></div></section>

    <section id="gallery" className="ks-section">
      <Heading label="REAL PHOTOS FROM OUR WORKSHOP">OUR GALLERY</Heading>
      <div className="ks-gallery-grid">{gallery.map((photo, i) => <button className="ks-gallery-item" data-reveal key={photo.name} onClick={e => { lastPhoto.current = e.currentTarget; setPreview(i); }} aria-label={"View " + photo.name}><img src={photo.image} alt={photo.name} loading="lazy" /><span>{photo.name}</span></button>)}</div>
    </section>

    <section id="contact" className="ks-section ks-light">
      <Heading label="VISIT US TODAY">OUR LOCATION</Heading>
      <div className="ks-contact-grid" data-reveal>
        <div className="ks-contact-card"><MapPin size={40} /><h2>{shop}</h2><p>{address}</p><a href={tel}><Phone size={18} />092679 23927</a><a href={directions} target="_blank" rel="noopener noreferrer" className="ks-btn"><Navigation size={18} />Get Directions</a></div>
        <iframe className="ks-map" title="Karthikeya Speed Car Wash location" src={"https://maps.google.com/maps?q=" + mapQuery + "&z=16&output=embed"} loading="lazy" allowFullScreen />
        <div className="ks-hours"><Clock size={42} /><h2>OPENING HOURS</h2><p>Closing time</p><strong>8:00 PM</strong><p>Call our service centre to confirm today's opening hours.</p><a href={tel} className="ks-btn-outline">Call Now</a></div>
      </div>
    </section>

    <footer className="ks-footer"><div className="ks-footer-grid"><div><img className="ks-footer-logo" src={logo} alt={shop} /><p>Professional car wash and detailing services in Vijayawada.</p><a href={tel}>+91 92679 23927</a></div><div><h3>QUICK LINKS</h3>{nav.map(item => <a key={item.href} href={item.href}>{item.name}</a>)}<Link to={dashboardPath}>{user ? "Dashboard" : "Login"}</Link>{!user && <Link to="/register">Register</Link>}</div><div><h3>CONTACT INFORMATION</h3><p>{address}</p><p>Closing time: 8:00 PM</p><a href={directions} target="_blank" rel="noopener noreferrer">Get directions</a></div></div><div className="ks-copyright">© {new Date().getFullYear()} {shop}. All rights reserved.</div></footer>
    <a className="ks-floating-call" href={tel} aria-label="Call Karthikeya Speed Car Wash"><Phone size={25} /></a>
    {preview !== null && <div className="ks-preview" role="dialog" aria-modal="true" aria-label="Shop photo preview" onClick={closeGallery}><button ref={closePreview} className="ks-preview-close" aria-label="Close image preview" onClick={closeGallery}><X size={30} /></button><button className="ks-preview-prev" aria-label="Previous photo" onClick={e => { e.stopPropagation(); setPreview((preview - 1 + gallery.length) % gallery.length); }}><ChevronLeft /></button><img src={gallery[preview].image} alt={gallery[preview].name} onClick={e => e.stopPropagation()} /><button className="ks-preview-next" aria-label="Next photo" onClick={e => { e.stopPropagation(); setPreview((preview + 1) % gallery.length); }}><ChevronRight /></button></div>}
  </div>;
}
