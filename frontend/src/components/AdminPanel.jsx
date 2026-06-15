import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminPanel({ token, logout }) {
    const [users, setUsers] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [statusMessage, setStatusMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    const config = { headers: { Authorization: `Bearer ${token}` } };

    const loadUsers = async () => {
        try {
            const res = await axios.get('https://onrender.com', config);
            setUsers(res.data);
        } catch (err) {
            handleApiError(err);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleApiError = (err) => {
        if (err.response?.data?.forceLogout) {
            alert(err.response.data.error || 'The session has ended.');
            logout();
        } else {
            setStatusMessage('Error: Failed to load data. Make sure the backend is running.');
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(filteredUsers.map(u => u.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectRow = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(item => item !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleToolbarAction = async (endpoint) => {
        if (selectedIds.length === 0) return;
        try {
            const res = await axios.post(`https://onrender.com${endpoint}`, { ids: selectedIds }, config);
            setStatusMessage(res.data.message);
            setSelectedIds([]);
            await loadUsers();
        } catch (err) {
            handleApiError(err);
        }
    };

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatRelativeTime = (dateString) => {
        if (!dateString) return 'less than a minute ago';
        const now = new Date();
        const past = new Date(dateString);
        const diffMins = Math.floor((now - past) / 60000);
        if (diffMins < 1) return 'less than a minute ago';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        return past.toLocaleDateString();
    };

    return (
        <div className="container bg-white my-4 p-4 shadow-sm rounded">
            <div className="d-flex justify-content-end align-items-center mb-4 text-muted small">
                <span className="me-3">Active session: <strong className="text-dark">{currentUser.name || 'User'}</strong></span>
                <button className="btn btn-link btn-sm text-danger text-decoration-none p-0 fw-bold" onClick={logout}>Exit</button>
            </div>

            {statusMessage && <div className="alert alert-danger py-2 small shadow-sm mb-3">{statusMessage}</div>}

            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                <div className="d-flex align-items-center border rounded bg-light p-1 shadow-sm gap-1">
                    <button
                        className="btn btn-sm btn-white text-primary border px-3 fw-bold d-flex align-items-center gap-1"
                        style={{ backgroundColor: '#fff', borderColor: '#cbd5e1' }}
                        disabled={selectedIds.length === 0}
                        onClick={() => handleToolbarAction('block')}
                    >
                        <i className="fa-solid fa-lock"></i> Block
                    </button>
                    <button
                        className="btn btn-sm btn-light border px-2 text-secondary"
                        disabled={selectedIds.length === 0}
                        onClick={() => handleToolbarAction('unblock')}
                    >
                        <i className="fa-solid fa-unlock"></i>
                    </button>
                    <button
                        className="btn btn-sm btn-light border px-2 text-danger"
                        disabled={selectedIds.length === 0}
                        onClick={() => handleToolbarAction('delete')}
                    >
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                    <button
                        className="btn btn-sm btn-light border px-2 text-warning"
                        disabled={selectedIds.length === 0}
                        onClick={() => handleToolbarAction('delete-unverified')}
                    >
                        <i className="fa-solid fa-user-minus"></i>
                    </button>
                </div>

                <div style={{ maxWidth: '240px', width: '100%' }}>
                    <input
                        type="text"
                        className="form-control form-control-sm bg-light border-secondary-subtle"
                        placeholder="Filter"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="table-responsive border rounded shadow-sm">
                <table className="table align-middle mb-0" style={{ fontSize: '0.9rem' }}>
                    <thead className="table-light text-uppercase text-muted" style={{ fontSize: '0.75rem' }}>
                    <tr>
                        <th style={{ width: '40px' }} className="ps-3">
                            <input
                                type="checkbox"
                                className="form-check-input"
                                onChange={handleSelectAll}
                                checked={filteredUsers.length > 0 && selectedIds.length === filteredUsers.length}
                            />
                        </th>
                        <th>Name</th>
                        <th>Email <i className="fa-solid fa-arrow-down-short-wide text-body-tertiary ms-1"></i></th>
                        <th>Status</th>
                        <th>Last seen</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filteredUsers.length === 0 ? (
                        <tr>
                            <td colSpan="5" className="text-center py-5 text-muted small">
                                No users found. Log in to the system or start the backend server.
                            </td>
                        </tr>
                    ) : (
                        filteredUsers.map(user => {
                            const isBlocked = user.status === 'blocked';
                            const isSelected = selectedIds.includes(user.id);
                            return (
                                <tr key={user.id} className={isSelected ? 'table-primary' : ''}>
                                    <td className="ps-3">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={isSelected}
                                            onChange={() => handleSelectRow(user.id)}
                                        />
                                    </td>
                                    <td>
                      <span className={`fw-bold d-block m-0 ${isBlocked ? 'text-decoration-line-through text-muted' : 'text-dark'}`}>
                        {user.name}
                      </span>
                                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                                            {isBlocked ? 'Regional Manager, Amazon.com, Inc.' : 'N/A'}
                                        </small>
                                    </td>
                                    <td className="text-secondary">{user.email}</td>
                                    <td>
                      <span className={`fw-bold ${isBlocked ? 'text-danger' : 'text-success'}`}>
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </span>
                                    </td>
                                    <td>
                                        <div className="d-flex flex-column gap-1">
                                            <span>{formatRelativeTime(user.last_login)}</span>
                                            <div className="d-flex gap-1 align-items-end" style={{ height: '14px' }}>
                                                <div className="bg-primary" style={{ width: '3px', height: '4px', opacity: 0.3 }}></div>
                                                <div className="bg-primary" style={{ width: '3px', height: '8px', opacity: 0.6 }}></div>
                                                <div className="bg-primary" style={{ width: '3px', height: '14px' }}></div>
                                                <div className="bg-primary" style={{ width: '3px', height: '3px', opacity: 0.3 }}></div>
                                                <div className="bg-primary" style={{ width: '3px', height: '10px', opacity: 0.8 }}></div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}