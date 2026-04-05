'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

type GuardedServerActionFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
};

export function GuardedServerActionForm({
  action,
  children,
  className,
}: GuardedServerActionFormProps) {
  const submitLockRef = useRef(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  useEffect(() => {
    submitLockRef.current = false;
  }, [pathname, searchKey]);

  return (
    <form
      action={action}
      className={className}
      onSubmitCapture={(event) => {
        if (submitLockRef.current) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        submitLockRef.current = true;
      }}
    >
      {children}
    </form>
  );
}
