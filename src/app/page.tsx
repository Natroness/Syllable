'use client';

import { useRouter } from 'next/navigation';
import SplitText from './components/SplitText';

export default function Home() {
  const router = useRouter();

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <SplitText
        text="SYLLABLE"
        tag="h1"
        className="text-7xl font-bold tracking-widest text-black"
        delay={80}
        duration={1.4}
        ease="power3.out"
        splitType="chars"
        from={{ opacity: 0, y: 50 }}
        to={{ opacity: 1, y: 0 }}
        threshold={0}
        rootMargin="0px"
        textAlign="center"
        onLetterAnimationComplete={() => {
          setTimeout(() => router.push('/upload'), 600);
        }}
      />
    </div>
  );
}
