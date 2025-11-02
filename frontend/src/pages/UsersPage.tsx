/**
 * Users Page
 * User management and administration
 */

import { Users, UserPlus, Download } from 'lucide-react'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import { UserTable } from '../components/admin/UserTable'
import { Button } from '../components/common'

export default function UsersPage() {
  const handleExportUsers = () => {
    // TODO: Implement user export functionality
    console.log('Export users')
  }

  const handleInviteUser = () => {
    // TODO: Implement user invite functionality
    console.log('Invite user')
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <Users size={28} className="text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">User Management</h1>
                <p className="text-gray-400 mt-1">
                  Manage user accounts, roles, and permissions
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportUsers}
                className="gap-2"
              >
                <Download size={16} />
                Export
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleInviteUser}
                className="gap-2"
              >
                <UserPlus size={18} />
                Invite User
              </Button>
            </div>
          </div>
        </div>

        {/* User Table Component */}
        <UserTable />
      </div>
    </DashboardLayout>
  )
}
