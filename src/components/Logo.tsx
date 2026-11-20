export default function Logo({ className = "h-5" }: { className?: string }) {
  // Wordmark MUV: letras geométricas + traço de velocidade em lima
  return (
    <svg viewBox="0 0 92 24" className={className} aria-label="MUV">
      <path fill="currentColor" d="M0 24V0h6.6L12 13.2 17.4 0H24v24h-5.4V10.6L14 21.6h-4L5.4 10.6V24zM28 0h5.6v14.6c0 3.4 1.8 4.8 4.4 4.8s4.4-1.4 4.4-4.8V0H48v14.8C48 21 44 24 38 24s-10-3-10-9.2zM50.5 0h6l5.8 17.4L68.1 0h6l-8.8 24h-6z" />
      <path fill="#D5FF45" d="M78 18h14l-2 6H76z" />
    </svg>
  );
}
