import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminVocalCoach() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/admin/vocal-coach/assignments', { replace: true }); }, []);
  return null;
}
