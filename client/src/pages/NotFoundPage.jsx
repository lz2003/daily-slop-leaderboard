import { Link } from 'react-router';

export default function NotFoundPage() {
  return <div className="card empty">Page not found. <Link to="/">Go home</Link></div>;
}
