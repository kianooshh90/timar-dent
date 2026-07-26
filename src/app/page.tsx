import { redirect } from 'next/navigation';

// The user-facing entry route redirects to the standalone static
// TDC-Intro site (served from /public/TDC-Intro/index.html).
export default function Page() {
  redirect('/TDC-Intro/index.html');
}
