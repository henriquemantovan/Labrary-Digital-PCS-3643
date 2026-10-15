export function Icon({
  name,
  size = 20,
}: {
  name:
    | "grid"
    | "arrow"
    | "lock"
    | "logout"
    | "search"
    | "user"
    | "book"
    | "check"
    | "eye"
    | "eyeOff"
    | "folder"
    | "back";
  size?: number;
}) {
  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    back: (
      <>
        <path d="M19 12H5m6-6-6 6 6 6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
      </>
    ),
    logout: (
      <>
        <path d="M9 4H5v16h4m0-8h12m-5-5 5 5-5 5" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    book: (
      <>
        <path d="M12 6v15M3 3h4a5 5 0 0 1 5 3 5 5 0 0 1 5-3h4v15h-4a5 5 0 0 0-5 3 5 5 0 0 0-5-3H3Z" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="m3 3 18 18M9 5.5c1-.3 2-.5 3-.5 6 0 10 7 10 7a21 21 0 0 1-3 4M6 6a21 21 0 0 0-4 6s4 7 10 7c2 0 4-.7 5-1.5" />
      </>
    ),
    folder: (
      <path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
