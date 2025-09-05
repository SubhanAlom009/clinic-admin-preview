import React from "react";
import { useRobustQueue } from "../hooks/useRobustQueue";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  Play,
  RotateCcw,
  X,
  Activity,
} from "lucide-react";
import { format, parseISO } from "date-fns";

export function QueueMonitor() {
  const {
    jobs,
    metrics,
    notifications,
    isProcessing,
    processQueue,
    retryFailedJobs,
    cancelJob,
    refresh,
  } = useRobustQueue();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "RUNNING":
        return <Play className="h-4 w-4 text-blue-600" />;
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "FAILED":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "CANCELLED":
        return <X className="h-4 w-4 text-gray-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "RUNNING":
        return "bg-blue-100 text-blue-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      case "CANCELLED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Queue Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Pending Jobs
                </p>
                <p className="text-2xl font-bold text-yellow-600">
                  {metrics.pendingJobs}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {metrics.pendingJobs > 5 ? "High queue load" : "Normal load"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Running Jobs
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {metrics.runningJobs}
                </p>
              </div>
              <Play className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {isProcessing ? "Processing now" : "Idle"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed Jobs</p>
                <p className="text-2xl font-bold text-red-600">
                  {metrics.failedJobs}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {metrics.failedJobs > 0 ? "Needs attention" : "All good"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Avg Process Time
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {metrics.avgProcessingTime}s
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {metrics.avgProcessingTime < 10 ? "Fast" : "Slow"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Notification Queue Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Notification Queue Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {notifications.pending}
              </p>
              <p className="text-sm text-gray-600">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {notifications.sent}
              </p>
              <p className="text-sm text-gray-600">Sent</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {notifications.failed}
              </p>
              <p className="text-sm text-gray-600">Failed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queue Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={processQueue}
              disabled={isProcessing}
              className="flex items-center"
            >
              <Play className="h-4 w-4 mr-2" />
              {isProcessing ? "Processing..." : "Process Queue"}
            </Button>

            <Button
              variant="outline"
              onClick={retryFailedJobs}
              disabled={metrics.failedJobs === 0}
              className="flex items-center"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry Failed ({metrics.failedJobs})
            </Button>

            <Button
              variant="outline"
              onClick={refresh}
              className="flex items-center"
            >
              <Activity className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {metrics.lastProcessedAt && (
            <p className="text-sm text-gray-500 mt-2">
              Last processed:{" "}
              {format(parseISO(metrics.lastProcessedAt), "MMM dd, HH:mm:ss")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No recent jobs</div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <div className="font-medium text-sm">
                        {job.job_type.replace("_", " ")}
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(parseISO(job.created_at), "MMM dd, HH:mm:ss")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {job.retry_count > 0 && (
                      <span className="text-xs text-orange-600">
                        Retry #{job.retry_count}
                      </span>
                    )}

                    <Badge className={getStatusColor(job.status)}>
                      {job.status}
                    </Badge>

                    {job.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancelJob(job.id)}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
