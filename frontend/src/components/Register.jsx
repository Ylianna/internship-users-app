import { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await axios.post('https://internship-backend-3no2.onrender.com/api/auth/register', { name, email, password });
            setMessage(res.data.message);
        } catch (err) {
            setError(err.response?.data?.error || 'Registration error');
        }
    };

    return (
        <div className="container d-flex justify-content-center align-items-center vh-100">
            <div className="card p-4 shadow-sm" style={{ width: '400px' }}>
                <h3 className="text-center text-primary mb-3">Registration</h3>
                {error && <div className="alert alert-danger p-2 small">{error}</div>}
                {message && <div className="alert alert-success p-2 small">{message}</div>}
                <form onSubmit={handleRegister}>
                    <div className="mb-3">
                        <label className="form-label small">Name</label>
                        <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div className="mb-3">
                        <label className="form-label small">E-mail</label>
                        <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="mb-3">
                        <label className="form-label small">Password</label>
                        <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-success w-100 mb-3">Register</button>
                </form>
                <div className="text-center small">
                    Already registered? <Link to="/login">Sign In</Link>
                </div>
            </div>
        </div>
    );
}