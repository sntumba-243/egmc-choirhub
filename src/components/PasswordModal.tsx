import { X, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';

interface PasswordModalProps {
  isOpen: boolean;
  email: string;
  password: string;
  memberName: string;
  onClose: () => void;
}

export const PasswordModal = ({ isOpen, email, password, memberName, onClose }: PasswordModalProps) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Member Created!</h2>
            <p className="text-sm text-gray-600">{memberName}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-medium mb-2">Login Credentials</p>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-blue-700">Email</p>
                <p className="font-mono text-sm text-blue-900">{email}</p>
              </div>
              <div>
                <p className="text-xs text-blue-700">Password</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-lg font-bold text-blue-900 flex-1">{password}</p>
                  <button
                    onClick={copyToClipboard}
                    className="p-2 hover:bg-blue-100 rounded transition-colors"
                    title="Copy password"
                  >
                    {copied ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5 text-blue-600" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800">
              ⚠️ Make sure to save this password! Share it securely with the member.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={copyToClipboard}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy Password'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
