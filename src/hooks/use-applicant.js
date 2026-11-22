import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';

// The applicant who is signed in (or null). The account is only good for filling in the application.
export default function useApplicant() {
  const [state, setState] = useState({ loading: true, applicant: null });

  useEffect(() => {
    let cancelled = false;
    api.applicant.me()
      .then((applicant) => { if (!cancelled) setState({ loading: false, applicant }); })
      .catch(() => { if (!cancelled) setState({ loading: false, applicant: null }); });
    return () => { cancelled = true; };
  }, []);

  const setApplicant = useCallback((applicant) => setState({ loading: false, applicant }), []);
  return { ...state, setApplicant };
}
