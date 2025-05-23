const Table = ({autoActivityByAudio, autoActivityByText, autoBreathByAudio, autoBreathByText, rows}) => {
    return (
    <div className="max-h-100 min-h-5 overflow-y-auto
          [&::-webkit-scrollbar]:w-1
          [&::-webkit-scrollbar-track]:bg-gray-500
          [&::-webkit-scrollbar-thumb]:bg-white/70 [&::-webkit-scrollbar-thumb]:rounded">
          <table className="w-full h-full min-h-5 px-10 text-lg border-3">
          <thead className="">
            <tr>
              <th className="border px-2">Transcript</th>
              <th className="border px-2">Time</th>
              <th className="border px-2">Actual IE</th>
              {autoBreathByText ? <th className="border px-2">Text IE</th> : ""}
              {autoBreathByAudio ? <th className="border px-2">Audio IE</th> : ""}
              <th className="border px-2">Filename</th>
              {autoActivityByText ? <th className="border px-2">Text Activity</th> : ""}
              {autoActivityByAudio ? <th className="border px-2">Audio Activity</th> : ""}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="border px-1">{r.transcript}</td>
                <td className="border px-1">{r.recording_time}</td>
                <td className="border px-1">{r.inhale_exhale}</td>
                {autoBreathByText ? <td className="border px-1">{r.ie_predicted_text}</td> : ""}
                {autoBreathByAudio ? <td className="border px-1">{r.ie_predicted_audio}</td> : ""}
                <td className="border px-1">{r.activity}</td>
                {autoActivityByText ? <td className="border px-1">{r.activity_predicted_text}</td> : ""}
                {autoActivityByAudio ? <td className="border px-1">{r.activity_predicted_audio}</td> : ""}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
    )
}

export default Table;